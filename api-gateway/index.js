const express = require('express');
const jwt = require('jsonwebtoken');
const httpProxy = require('http-proxy');
require('dotenv').config();

const app = express();
app.use(express.json());
const proxy = httpProxy.createProxyServer();
const PORT = process.env.PORT;

// Forward verified user identity to downstream services
proxy.on('proxyReq', (proxyReq, req) => {
    if (req.user) {
        proxyReq.setHeader('x-user-id', req.user.id);
        proxyReq.setHeader('x-user-role', req.user.role);
        proxyReq.setHeader('x-user-email', req.user.email);
    }

    if (req.body && ['POST', 'PUT', 'PATCH'].includes(req.method)) {
        const bodyData = JSON.stringify(req.body);
        proxyReq.setHeader('Content-Type', 'application/json');
        proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
        proxyReq.write(bodyData);
    }
});

proxy.on('error', (err, req, res) => {
    console.error('Proxy error:', err.message);
    if (!res.headersSent) {
        res.status(502).json({ message: 'Bad gateway', error: err.message });
    }
});
const JWT_SECRET = process.env.JWT_SECRET;

// Middleware 
function authToken(req, res, next) {
    const header = req?.headers.authorization;
    const token = header && header.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.error(err);
            return res.status(403).json({ message: 'Invalid token' });
        }
        req.user = user;
        next();
    });
}

function checkRole(...allowedRoles) {
    return (req, res, next) => {
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Unauthorized' });
        }
        next();
    }
};

// routes
// ----------------------------------------------------------------------------
// 1. identity-service routes
app.post('/register', authToken, checkRole('admin'), (req, res) => {
    proxy.web(req, res, { target: `http://${process.env.IDENTITY_IP}:3001` });
});

app.post('/login', (req, res) => {
    proxy.web(req, res, { target: `http://${process.env.IDENTITY_IP}:3001`});
});

// List all users - protected route, admin only
app.get('/users', authToken, checkRole('admin'), (req, res) => {
    proxy.web(req, res, { target: `http://${process.env.IDENTITY_IP}:3001` });
});

app.delete('/users/:id', authToken, checkRole('admin'), (req, res) => {
    proxy.web(req, res, { target: `http://${process.env.IDENTITY_IP}:3001` });
});

// ----------------------------------------------------------------------------
// 2. member-service routes
// Member traffic goes through the internal Nginx load balancer when
// MEMBER_LB_URL is set (e.g. http://nginx:8081), otherwise straight to a
// single member-service instance.
function proxyMember(req, res) {
    const target = process.env.MEMBER_LB_URL || `http://${process.env.MEMBER_IP}:3002`;
    proxy.web(req, res, { target });
}

app.get('/members',        authToken, checkRole('admin'), proxyMember);
app.post('/members',       authToken, checkRole('admin'), proxyMember);
app.get('/members/me',     authToken, checkRole('member'), proxyMember);
app.put('/members/me',     authToken, checkRole('member'), proxyMember);
app.get('/members/:id',    authToken, checkRole('admin'), proxyMember);
app.put('/members/:id',    authToken, checkRole('admin'), proxyMember);
app.delete('/members/:id', authToken, checkRole('admin'), proxyMember);

// ----------------------------------------------------------------------------
// 3. trainer-service routes
function proxyTrainer(req, res) {
    proxy.web(req, res, { target: `http://${process.env.TRAINER_IP}:3003` });
}
app.get('/trainers',        authToken,                       proxyTrainer); // all roles
app.post('/trainers',       authToken, checkRole('admin'),   proxyTrainer); // admin only
app.get('/trainers/me',     authToken, checkRole('trainer'), proxyTrainer); // trainer only
app.put('/trainers/me',     authToken, checkRole('trainer'), proxyTrainer); // trainer only
app.get('/trainers/:id',    authToken,                       proxyTrainer); // all roles
app.put('/trainers/:id',    authToken, checkRole('admin'),   proxyTrainer); // admin only
app.delete('/trainers/:id', authToken, checkRole('admin'),   proxyTrainer); // admin only

// ----------------------------------------------------------------------------
// 4. workout-service routes
function proxyWorkout(req, res) {
    proxy.web(req, res, { target: `http://${process.env.WORKOUT_IP}:3004` });
}
app.post('/workouts',       authToken, checkRole('trainer', 'admin'), proxyWorkout); // trainer + admin
app.get('/workouts',        authToken,                       proxyWorkout); // all roles
app.get('/workouts/my',     authToken, checkRole('trainer', 'admin'), proxyWorkout); // trainer + admin
app.get('/workouts/:id',    authToken,                       proxyWorkout); // all roles
app.put('/workouts/:id',    authToken, checkRole('trainer', 'admin'), proxyWorkout); // trainer + admin; service enforces ownership
app.delete('/workouts/:id', authToken, checkRole('admin'),   proxyWorkout); // admin only

// ----------------------------------------------------------------------------
// 5. membership-service routes
function proxyMembership(req, res) {
    proxy.web(req, res, { target: `http://${process.env.MEMBERSHIP_IP}:3005` });
}

app.post('/plans',       authToken, checkRole('admin'), proxyMembership);
app.get('/plans',        authToken,                     proxyMembership);
app.put('/plans/:id',    authToken, checkRole('admin'), proxyMembership);
app.delete('/plans/:id', authToken, checkRole('admin'), proxyMembership);
// ----------------------------------------------------------------------------
// 6. attendance-service routes
function proxyAttendance(req, res) {
    proxy.web(req, res, { target: `http://${process.env.ATTENDANCE_IP}:3006` });
}

app.post('/checkin',             authToken, checkRole('member', 'admin'), proxyAttendance);
app.put('/checkout/me',          authToken, checkRole('member'), proxyAttendance);
app.put('/checkout/:id',         authToken, checkRole('admin'),  proxyAttendance);
app.get('/attendance/me',        authToken, checkRole('member'), proxyAttendance);
app.get('/attendance/:memberId', authToken, checkRole('trainer', 'admin'), proxyAttendance);
app.get('/attendance',           authToken, checkRole('admin'),  proxyAttendance);


app.listen(PORT, () => console.log(`API Gateway Started at Port No: ${PORT}`));
