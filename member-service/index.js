const express = require('express');
const mongoose = require('mongoose');

const dbConnect = require('./dbConnect');
const Member = require('./models/member');
require('dotenv').config();

const app = express();
app.use(express.json());
dbConnect();

const port = process.env.PORT;
const instance = process.env.INSTANCE || 'member-service';

// Request logger — prints which instance handled the request so load
// balancing across member-service-1 / member-service-2 is visible in logs.
app.use((req, _res, next) => {
    console.log(`[${instance}] ${req.method} ${req.originalUrl}`);
    next();
});

// GET /members - list all members
app.get('/members', async (req, res) => {
    try {
        const members = await Member.find();
        res.json(members);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch members', error: err.message });
    }
});

// POST /members - create a member profile
app.post('/members', async (req, res) => {
    try {
        const member = await Member.create(req.body);
        res.status(201).json({ message: 'Member created successfully', member });
    } catch (err) {
        res.status(500).json({ message: 'Failed to create member', error: err.message });
    }
});

// GET /members/me - get the logged-in member's own profile (member role)
// Must be declared before /members/:id so "me" is not treated as an :id.
app.get('/members/me', async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        const member = await Member.findOne({ userId });
        if (!member) return res.status(404).json({ message: 'Member profile not found' });
        res.json(member);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch member profile', error: err.message });
    }
});

// PUT /members/me - update the logged-in member's own allowed fields (member role)
// Members may only change name and phone; plan/isActive remain admin-managed.
app.put('/members/me', async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        const { name, phone } = req.body;
        const updates = {};
        if (name !== undefined) updates.name = name;
        if (phone !== undefined) updates.phone = phone;

        const member = await Member.findOneAndUpdate({ userId }, updates, {
            new: true,
            runValidators: true
        });
        if (!member) return res.status(404).json({ message: 'Member profile not found' });

        res.json({ message: 'Member profile updated successfully', member });
    } catch (err) {
        res.status(500).json({ message: 'Failed to update member profile', error: err.message });
    }
});

// GET /members/:id - get one member profile
app.get('/members/:id', async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Invalid member ID' });
        }

        const member = await Member.findById(req.params.id);
        if (!member) return res.status(404).json({ message: 'Member not found' });

        res.json(member);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch member', error: err.message });
    }
});

// PUT /members/:id - update one member profile
app.put('/members/:id', async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Invalid member ID' });
        }

        const member = await Member.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });

        if (!member) return res.status(404).json({ message: 'Member not found' });

        res.json({ message: 'Member updated successfully', member });
    } catch (err) {
        res.status(500).json({ message: 'Failed to update member', error: err.message });
    }
});

// DELETE /members/:id - delete one member profile
app.delete('/members/:id', async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Invalid member ID' });
        }

        const member = await Member.findByIdAndDelete(req.params.id);
        if (!member) return res.status(404).json({ message: 'Member not found' });

        res.json({ message: 'Member deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to delete member', error: err.message });
    }
});

app.listen(port, () => console.log(`Member service started at port ${port}`));
