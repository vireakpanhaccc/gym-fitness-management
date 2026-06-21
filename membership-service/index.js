require('dotenv').config();
const express = require('express');
const dbConnect = require('./dbConnect');
const Plan = require('./models/Plan');

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

// ── Admin guard middleware ─────────────────────
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Forbidden: admin access required' });
  }
  next();
};

// ── Routes ────────────────────────────────────

// Health check
app.get('/health', (_req, res) => {
  res.json({ service: 'membership-service', status: 'ok', port: PORT });
});

// POST /plans  (admin only) — Create a new membership plan
app.post('/plans', requireAdmin, async (req, res) => {
  try {
    const { name, price, features, duration, isActive } = req.body;

    if (!name || price === undefined || !duration) {
      return res.status(400).json({ message: 'name, price, and duration are required' });
    }

    const existing = await Plan.findOne({ name });
    if (existing) {
      return res.status(409).json({ message: `A plan named "${name}" already exists` });
    }

    const plan = new Plan({ name, price, features, duration, isActive });
    await plan.save();

    res.status(201).json({ message: 'Plan created successfully', plan });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /plans  (all roles) — List all membership plans
app.get('/plans', async (_req, res) => {
  try {
    const plans = await Plan.find().sort({ price: 1 });
    res.json(plans);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PUT /plans/:id  (admin only) — Update a plan's pricing or features
app.put('/plans/:id', requireAdmin, async (req, res) => {
  try {
    const { name, price, features, duration, isActive } = req.body;

    if (name) {
      const conflict = await Plan.findOne({ name, _id: { $ne: req.params.id } });
      if (conflict) {
        return res.status(409).json({ message: `Another plan named "${name}" already exists` });
      }
    }

    const updatedPlan = await Plan.findByIdAndUpdate(
      req.params.id,
      { name, price, features, duration, isActive },
      { new: true, runValidators: true, omitUndefined: true }
    );

    if (!updatedPlan) {
      return res.status(404).json({ message: 'Plan not found' });
    }

    res.json({ message: 'Plan updated successfully', plan: updatedPlan });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid plan ID' });
    }
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// DELETE /plans/:id  (admin only) — Remove a membership plan
app.delete('/plans/:id', requireAdmin, async (req, res) => {
  try {
    const deleted = await Plan.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({ message: 'Plan not found' });
    }

    res.json({ message: 'Plan deleted successfully', plan: deleted });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid plan ID' });
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// 404 fallback
app.use((_req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// ── Database + Server ─────────────────────────
const start = async () => {
  await dbConnect();
  app.listen(PORT, () => {
    console.log(`membership-service running on port ${PORT}`);
  });
};

start();
