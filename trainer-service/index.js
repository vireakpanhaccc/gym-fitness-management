const express = require('express');
const dbConnect = require('./dbConnect');
const Trainer = require('./models/trainer');
require('dotenv').config();

const app = express();
app.use(express.json());
dbConnect();

const PORT = process.env.PORT || 4004;

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'trainer-service' }));

// POST /trainers
app.post('/trainers', async (req, res) => {
    try {
        const trainer = await Trainer.create(req.body);
        res.status(201).json({ message: 'Trainer created', trainer });
    } catch (err) {
        res.status(500).json({ message: 'Failed to create trainer', error: err.message });
    }
});

// GET /trainers
app.get('/trainers', async (req, res) => {
    try {
        res.json(await Trainer.find());
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch trainers', error: err.message });
    }
});

// GET /trainers/:id
app.get('/trainers/:id', async (req, res) => {
    try {
        const trainer = await Trainer.findById(req.params.id);
        if (!trainer) return res.status(404).json({ message: 'Trainer not found' });
        res.json(trainer);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch trainer', error: err.message });
    }
});

// PUT /trainers/:id
app.put('/trainers/:id', async (req, res) => {
    try {
        const trainer = await Trainer.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!trainer) return res.status(404).json({ message: 'Trainer not found' });
        res.json({ message: 'Trainer updated', trainer });
    } catch (err) {
        res.status(500).json({ message: 'Failed to update trainer', error: err.message });
    }
});

// DELETE /trainers/:id
app.delete('/trainers/:id', async (req, res) => {
    try {
        const trainer = await Trainer.findByIdAndDelete(req.params.id);
        if (!trainer) return res.status(404).json({ message: 'Trainer not found' });
        res.json({ message: 'Trainer deleted' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to delete trainer', error: err.message });
    }
});

app.listen(PORT, () => console.log(`trainer-service running on PORT ${PORT}`));
