const express = require('express');
const dbConnect = require('./dbConnect');
const Plan = require('./models/plan');
const Subscription = require('./models/subscription');
require('dotenv').config();

const app = express();
app.use(express.json());
dbConnect();

const PORT = process.env.PORT || 4003;

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'membership-service' }));

// ---- Plans ----
app.post('/plans', async (req, res) => {
    try {
        const plan = await Plan.create(req.body);
        res.status(201).json({ message: 'Plan created', plan });
    } catch (err) {
        res.status(500).json({ message: 'Failed to create plan', error: err.message });
    }
});

app.get('/plans', async (req, res) => {
    try {
        res.json(await Plan.find());
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch plans', error: err.message });
    }
});

app.get('/plans/:id', async (req, res) => {
    try {
        const plan = await Plan.findById(req.params.id);
        if (!plan) return res.status(404).json({ message: 'Plan not found' });
        res.json(plan);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch plan', error: err.message });
    }
});

app.put('/plans/:id', async (req, res) => {
    try {
        const plan = await Plan.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!plan) return res.status(404).json({ message: 'Plan not found' });
        res.json({ message: 'Plan updated', plan });
    } catch (err) {
        res.status(500).json({ message: 'Failed to update plan', error: err.message });
    }
});

app.delete('/plans/:id', async (req, res) => {
    try {
        const plan = await Plan.findByIdAndDelete(req.params.id);
        if (!plan) return res.status(404).json({ message: 'Plan not found' });
        res.json({ message: 'Plan deleted' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to delete plan', error: err.message });
    }
});

// ---- Subscriptions ----
app.post('/subscriptions', async (req, res) => {
    try {
        const subscription = await Subscription.create(req.body);
        res.status(201).json({ message: 'Subscription created', subscription });
    } catch (err) {
        res.status(500).json({ message: 'Failed to create subscription', error: err.message });
    }
});

app.get('/subscriptions', async (req, res) => {
    try {
        res.json(await Subscription.find());
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch subscriptions', error: err.message });
    }
});

app.get('/subscriptions/member/:memberId', async (req, res) => {
    try {
        res.json(await Subscription.find({ memberId: req.params.memberId }));
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch subscriptions', error: err.message });
    }
});

app.get('/subscriptions/:id', async (req, res) => {
    try {
        const subscription = await Subscription.findById(req.params.id);
        if (!subscription) return res.status(404).json({ message: 'Subscription not found' });
        res.json(subscription);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch subscription', error: err.message });
    }
});

app.put('/subscriptions/:id', async (req, res) => {
    try {
        const subscription = await Subscription.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!subscription) return res.status(404).json({ message: 'Subscription not found' });
        res.json({ message: 'Subscription updated', subscription });
    } catch (err) {
        res.status(500).json({ message: 'Failed to update subscription', error: err.message });
    }
});

app.delete('/subscriptions/:id', async (req, res) => {
    try {
        const subscription = await Subscription.findByIdAndDelete(req.params.id);
        if (!subscription) return res.status(404).json({ message: 'Subscription not found' });
        res.json({ message: 'Subscription deleted' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to delete subscription', error: err.message });
    }
});

app.listen(PORT, () => console.log(`membership-service running on PORT ${PORT}`));
