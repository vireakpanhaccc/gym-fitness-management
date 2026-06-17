const express = require('express');
const jwt = require('jsonwebtoken');
const httpProxy = require('http-proxy');
require('dotenv').config();

const app = express();
app.use(express.json());
const proxy = httpProxy.createProxyServer();
const PORT = process.env.PORT;
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

// List all trainers - protected route, admin only
app.use('/trainers', authToken, checkRole('admin'), (req, res) => {
    proxy.web(req, res, { target: `http://${process.env.TRAINER_IP}:3003` });
});

app.use('/workouts', authToken, checkRole('admin', 'trainer'), (req, res) => {
    proxy.web(req, res, { target: `http://${process.env.WORKOUT_IP}:3004` });
});

app.use('/memberships', authToken, checkRole('admin'), (req, res) => {
    proxy.web(req, res, { target: `http://${process.env.MEMBERSHIP_IP}:3005` });
});

app.listen(PORT, () => console.log(`API Gateway Started at Port No: ${PORT}`));
