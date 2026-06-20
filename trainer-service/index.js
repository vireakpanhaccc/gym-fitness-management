const express = require('express');
const mongoose = require('mongoose');

const dbConnect = require('./dbConnect');
const Trainer = require('./models/trainer');
require('dotenv').config();

const app = express();
app.use(express.json());
dbConnect();

const port = process.env.PORT;

// GET /trainers - list all trainers (all roles)
app.get('/trainers', async (req, res) => {
    try {
        const trainers = await Trainer.find();
        res.json(trainers);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch trainers', error: err.message });
    }
});

// POST /trainers - create trainer profile (admin only, enforced at gateway)
app.post('/trainers', async (req, res) => {
    try {
        const trainer = await Trainer.create(req.body);
        res.status(201).json({ message: 'Trainer created successfully', trainer });
    } catch (err) {
        res.status(500).json({ message: 'Failed to create trainer', error: err.message });
    }
});

// GET /trainers/me - get logged-in trainer's own profile (trainer role)
app.get('/trainers/me', async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        const trainer = await Trainer.findOne({ userId });
        if (!trainer) return res.status(404).json({ message: 'Trainer profile not found' });
        res.json(trainer);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch trainer profile', error: err.message });
    }
});

// PUT /trainers/me - update logged-in trainer's own profile (trainer role)
app.put('/trainers/me', async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        const trainer = await Trainer.findOneAndUpdate(
            { userId },
            req.body,
            { new: true, runValidators: true }
        );
        if (!trainer) return res.status(404).json({ message: 'Trainer profile not found' });
        res.json({ message: 'Trainer profile updated successfully', trainer });
    } catch (err) {
        res.status(500).json({ message: 'Failed to update trainer profile', error: err.message });
    }
});

// GET /trainers/:id - view one trainer's public profile (all roles)
app.get('/trainers/:id', async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Invalid trainer ID' });
        }
        const trainer = await Trainer.findById(req.params.id);
        if (!trainer) return res.status(404).json({ message: 'Trainer not found' });
        res.json(trainer);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch trainer', error: err.message });
    }
});

// PUT /trainers/:id - update any trainer profile (admin only, enforced at gateway)
app.put('/trainers/:id', async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Invalid trainer ID' });
        }
        const trainer = await Trainer.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });
        if (!trainer) return res.status(404).json({ message: 'Trainer not found' });
        res.json({ message: 'Trainer updated successfully', trainer });
    } catch (err) {
        res.status(500).json({ message: 'Failed to update trainer', error: err.message });
    }
});

// DELETE /trainers/:id - remove trainer (admin only, enforced at gateway)
app.delete('/trainers/:id', async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Invalid trainer ID' });
        }
        const trainer = await Trainer.findByIdAndDelete(req.params.id);
        if (!trainer) return res.status(404).json({ message: 'Trainer not found' });
        res.json({ message: 'Trainer deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to delete trainer', error: err.message });
    }
});

app.listen(port, () => console.log(`Trainer service started at port ${port}`));
