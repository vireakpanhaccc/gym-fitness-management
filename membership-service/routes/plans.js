const express = require('express');
const router = express.Router();
const Plan = require('../models/Plan');

// ──────────────────────────────────────────────
// POST /plans  (admin only)
// Create a new membership plan
// ──────────────────────────────────────────────
router.post('/', async (req, res) => {
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

// ──────────────────────────────────────────────
// GET /plans  (all roles)
// List all membership plans
// ──────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const plans = await Plan.find().sort({ price: 1 });
    res.json(plans);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ──────────────────────────────────────────────
// PUT /plans/:id  (admin only)
// Update a plan's pricing or features
// ──────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const { name, price, features, duration, isActive } = req.body;

    // Prevent duplicate name conflict when renaming
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

// ──────────────────────────────────────────────
// DELETE /plans/:id  (admin only)
// Remove a membership plan
// ──────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
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

module.exports = router;