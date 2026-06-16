const express = require('express');
const dbConnect = require('./dbConnect');
const Member = require('./models/member');
require('dotenv').config();

const app = express();
app.use(express.json());
dbConnect();

const PORT = process.env.PORT || 4002;

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'member-service' }));

// POST /members
app.post('/members', async (req, res) => {
    try {
        const member = await Member.create(req.body);
        res.status(201).json({ message: 'Member created', member });
    } catch (err) {
        res.status(500).json({ message: 'Failed to create member', error: err.message });
    }
});

// GET /members
app.get('/members', async (req, res) => {
    try {
        const members = await Member.find();
        res.json(members);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch members', error: err.message });
    }
});

// GET /members/:id
app.get('/members/:id', async (req, res) => {
    try {
        const member = await Member.findById(req.params.id);
        if (!member) return res.status(404).json({ message: 'Member not found' });
        res.json(member);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch member', error: err.message });
    }
});

// PUT /members/:id
app.put('/members/:id', async (req, res) => {
    try {
        const member = await Member.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!member) return res.status(404).json({ message: 'Member not found' });
        res.json({ message: 'Member updated', member });
    } catch (err) {
        res.status(500).json({ message: 'Failed to update member', error: err.message });
    }
});

// DELETE /members/:id
app.delete('/members/:id', async (req, res) => {
    try {
        const member = await Member.findByIdAndDelete(req.params.id);
        if (!member) return res.status(404).json({ message: 'Member not found' });
        res.json({ message: 'Member deleted' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to delete member', error: err.message });
    }
});

app.listen(PORT, () => console.log(`member-service running on PORT ${PORT}`));
