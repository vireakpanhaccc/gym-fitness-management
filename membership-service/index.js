require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db');

const planRoutes = require('./routes/plans');

const app = express();
const PORT = process.env.PORT || 3005;

// ── Middleware ────────────────────────────────
app.use(express.json());

// Trust headers forwarded by the API Gateway
// x-user-id, x-user-role, x-user-email are injected by the gateway
// after JWT verification. This service does NOT verify JWT itself.
app.use((req, _res, next) => {
  req.user = {
    id: req.headers['x-user-id'],
    role: req.headers['x-user-role'],
    email: req.headers['x-user-email'],
  };
  next();
});

// ── Routes ────────────────────────────────────
app.use('/plans', planRoutes);

// Health check
app.get('/health', (_req, res) => {
  res.json({ service: 'membership-service', status: 'ok', port: PORT });
});

// 404 fallback
app.use((_req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// ── Database + Server ─────────────────────────
const start = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`membership-service running on port ${PORT}`);
  });
};

start();