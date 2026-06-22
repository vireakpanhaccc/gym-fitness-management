const express = require('express');
const mongoose = require('mongoose');

const dbConnect = require('./dbConnect');
const Plan = require('./models/Plan');
require('dotenv').config();

const app = express();
app.use(express.json());
dbConnect();

const port = process.env.PORT;

// POST /plans - create membership plan (admin only, enforced at gateway)
app.post('/plans', async (req, res) => {
    try {
        const { name, price, duration } = req.body;
        if (!name || price === undefined || !duration) {
            return res.status(400).json({ message: 'name, price, and duration are required' });
        }

        const existing = await Plan.findOne({ name });
        if (existing) {
            return res.status(409).json({ message: `A plan named "${name}" already exists` });
        }

        const plan = await Plan.create(req.body);
        res.status(201).json({ message: 'Plan created successfully', plan });
    } catch (err) {
        if (err.name === 'ValidationError') {
            return res.status(400).json({ message: err.message });
        }
        res.status(500).json({ message: 'Failed to create plan', error: err.message });
    }
});

// GET /plans - list membership plans (all roles)
app.get('/plans', async (req, res) => {
    try {
        const plans = await Plan.find().sort({ price: 1 });
        res.json(plans);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch plans', error: err.message });
    }
});

// PUT /plans/:id - update membership plan (admin only, enforced at gateway)
app.put('/plans/:id', async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Invalid plan ID' });
        }

        if (req.body.name) {
            const conflict = await Plan.findOne({
                name: req.body.name,
                _id: { $ne: req.params.id }
            });
            if (conflict) {
                return res.status(409).json({ message: `Another plan named "${req.body.name}" already exists` });
            }
        }

        const plan = await Plan.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });
        if (!plan) return res.status(404).json({ message: 'Plan not found' });

        res.json({ message: 'Plan updated successfully', plan });
    } catch (err) {
        if (err.name === 'ValidationError') {
            return res.status(400).json({ message: err.message });
        }
        res.status(500).json({ message: 'Failed to update plan', error: err.message });
    }
});

// DELETE /plans/:id - remove membership plan (admin only, enforced at gateway)
app.delete('/plans/:id', async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Invalid plan ID' });
        }

        const plan = await Plan.findByIdAndDelete(req.params.id);
        if (!plan) return res.status(404).json({ message: 'Plan not found' });

        res.json({ message: 'Plan deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to delete plan', error: err.message });
    }
});

app.listen(port, () => console.log(`Membership service started at port ${port}`));
