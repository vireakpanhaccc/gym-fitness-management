const express = require('express');
const jwt = require('jsonwebtoken');
const { createProxyMiddleware } = require('http-proxy-middleware');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET;

// NOTE: intentionally NO express.json() here.
// Parsing the body would consume the request stream and break proxied
// POST/PUT bodies. The gateway only needs the Authorization header.

const ALL = ['admin', 'trainer', 'member'];

// ---- Auth middleware ----
function authenticate(req, res, next) {
    const header = req.headers['authorization'] || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'No token provided' });
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
}

function authorize(...roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Forbidden: insufficient role' });
        }
        next();
    };
}

// Method-aware role guard: GET uses readRoles, writes (POST/PUT/DELETE) use writeRoles.
function rbac(readRoles, writeRoles) {
    return (req, res, next) =>
        authenticate(req, res, () => {
            const roles = req.method === 'GET' ? readRoles : writeRoles;
            return authorize(...roles)(req, res, next);
        });
}

// Auth service guard: register/login/seed-admin are public; user management is admin-only.
const PUBLIC_AUTH = ['/login', '/register', '/seed-admin'];
function authGuard(req, res, next) {
    if (req.method === 'POST' && PUBLIC_AUTH.includes(req.path)) return next();
    return authenticate(req, res, () => authorize('admin')(req, res, next));
}

// ---- Proxy helper (mounted at root so pathFilter/pathRewrite see the full URL) ----
function proxy(pathFilter, target, pathRewrite) {
    return createProxyMiddleware({
        target,
        changeOrigin: true,
        pathFilter,
        pathRewrite,
        on: {
            error: (err, req, res) => {
                if (res && !res.headersSent) {
                    res.status(502).json({ message: 'Bad gateway', error: err.message });
                }
            },
        },
    });
}

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'api-gateway' }));

// ---- RBAC guards (path-prefixed; run before the proxies) ----
app.use('/api/auth', authGuard);
app.use('/api/members', rbac(ALL, ['admin']));
app.use('/api/plans', rbac(ALL, ['admin']));
app.use('/api/subscriptions', rbac(ALL, ['admin']));
app.use('/api/trainers', rbac(ALL, ['admin']));
app.use('/api/workouts', rbac(ALL, ['admin', 'trainer']));
app.use('/api/attendance', rbac(ALL, ALL));

// ---- Proxies (env-driven targets; no hardcoded hosts) ----
app.use(proxy((p) => p.startsWith('/api/auth'), process.env.IDENTITY_URL, { '^/api/auth': '' }));
app.use(proxy((p) => p.startsWith('/api/members'), process.env.MEMBER_URL, { '^/api': '' }));
app.use(
    proxy(
        (p) => p.startsWith('/api/plans') || p.startsWith('/api/subscriptions'),
        process.env.MEMBERSHIP_URL,
        { '^/api': '' }
    )
);
app.use(proxy((p) => p.startsWith('/api/trainers'), process.env.TRAINER_URL, { '^/api': '' }));
app.use(proxy((p) => p.startsWith('/api/workouts'), process.env.WORKOUT_URL, { '^/api': '' }));
app.use(proxy((p) => p.startsWith('/api/attendance'), process.env.ATTENDANCE_URL, { '^/api': '' }));

// Catch-all for unknown routes
app.use((req, res) => res.status(404).json({ message: 'Route not found' }));

app.listen(PORT, () => console.log(`api-gateway running on PORT ${PORT}`));
