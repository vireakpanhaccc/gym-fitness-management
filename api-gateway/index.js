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
        if (!allowedRoles.includes(req.user.role) && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Unauthorized' });
        }
        next();
    }
};

// routes
// ----------------------------------------------------------------------------
// identity-service routes
app.use('/register', authToken, checkRole('admin'), (req, res) => {
    proxy.web(req, res, { target: `http://${process.env.IDENTITY_IP}:3001` });
});

app.use('/login', (req, res) => {
    proxy.web(req, res, { target: `http://${process.env.IDENTITY_IP}:3001`});
});

// List all users - protected route, admin only
app.use('/users', authToken, checkRole('admin'), (req, res) => {
    proxy.web(req, res, { target: `http://${process.env.IDENTITY_IP}:3001` });
});

app.use('/users/:id', authToken, checkRole('admin'), (req, res) => {
    proxy.web(req, res, { target: `http://${process.env.IDENTITY_IP}:3001` });
});

// ----------------------------------------------------------------------------
// member-service routes
function proxyMember(req, res) {
    proxy.web(req, res, { target: `http://${process.env.MEMBER_IP}:3002` });
}

app.get('/members', authToken, checkRole('admin'), proxyMember);
app.post('/members', authToken, checkRole('admin'), proxyMember);
app.get('/members/:id', authToken, checkRole('admin', 'member'), proxyMember);
app.put('/members/:id', authToken, checkRole('admin', 'member'), proxyMember);
app.delete('/members/:id', authToken, checkRole('admin'), proxyMember);

// ----------------------------------------------------------------------------
// trainer-service routes
function proxyTrainer(req, res) {
    proxy.web(req, res, { target: `http://${process.env.TRAINER_IP}:3003` });
}
app.get('/trainers',        authToken,                       proxyTrainer); // all roles
app.post('/trainers',       authToken, checkRole('admin'),   proxyTrainer); // admin only
app.get('/trainers/me',     authToken, checkRole('trainer'), proxyTrainer); // trainer + admin
app.put('/trainers/me',     authToken, checkRole('trainer'), proxyTrainer); // trainer + admin
app.get('/trainers/:id',    authToken,                       proxyTrainer); // all roles
app.put('/trainers/:id',    authToken, checkRole('admin'),   proxyTrainer); // admin only
app.delete('/trainers/:id', authToken, checkRole('admin'),   proxyTrainer); // admin only

// ----------------------------------------------------------------------------
// workout-service routes
function proxyWorkout(req, res) {
    proxy.web(req, res, { target: `http://${process.env.WORKOUT_IP}:3004` });
}
app.post('/workouts',       authToken, checkRole('trainer'), proxyWorkout); // trainer + admin
app.get('/workouts',        authToken,                       proxyWorkout); // all roles
app.get('/workouts/my',     authToken, checkRole('trainer'), proxyWorkout); // trainer + admin
app.get('/workouts/:id',    authToken,                       proxyWorkout); // all roles
app.put('/workouts/:id',    authToken, checkRole('trainer'), proxyWorkout); // trainer + admin; service enforces ownership
app.delete('/workouts/:id', authToken, checkRole('admin'),   proxyWorkout); // admin only

app.use('/memberships', authToken, checkRole('admin'), (req, res) => {
    proxy.web(req, res, { target: `http://${process.env.MEMBERSHIP_IP}:3005` });
});

app.listen(PORT, () => console.log(`API Gateway Started at Port No: ${PORT}`));
