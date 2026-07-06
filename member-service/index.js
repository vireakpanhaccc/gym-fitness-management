const express = require('express');
const mongoose = require('mongoose');
const fs = require('fs');
const os = require('os');
const path = require('path');

const dbConnect = require('./dbConnect');
const Member = require('./models/member');
require('dotenv').config();

const app = express();
app.use(express.json());
dbConnect();

const port = process.env.PORT;
const instance = process.env.INSTANCE || 'member-service';

// Request logger for load-balancer proof.
app.use((req, _res, next) => {
    console.log(`[${instance}] ${req.method} ${req.originalUrl}`);
    next();
});

// Shared-volume access log: identity-service and member-service both append to the
// same mounted file (k8s/shared-volume/) to demonstrate multi-container/multi-service
// access to shared data.
const SHARED_LOG_FILE = path.join(process.env.LOG_DIR || '/var/log/app', 'access.log');
app.use((req, res, next) => {
    res.on('finish', () => {
        const line = `${new Date().toISOString()} [member-service] [pod:${os.hostname()}] ${req.method} ${req.originalUrl} -> ${res.statusCode}\n`;
        fs.appendFile(SHARED_LOG_FILE, line, (err) => {
            if (err) console.error('Shared log write failed:', err.message);
        });
    });
    next();
});

// POST /members - create member profile (admin only, enforced at gateway)
app.post('/members', async (req, res) => {
    try {
        const member = await Member.create(req.body);
        res.status(201).json({ message: 'Member created successfully', member });
    } catch (err) {
        res.status(500).json({ message: 'Failed to create member', error: err.message });
    }
});

// GET /members - list all members (admin only, enforced at gateway)
app.get('/members', async (req, res) => {
    try {
        const members = await Member.find();
        res.json(members);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch members', error: err.message });
    }
});

// GET /members/me - get logged-in member's own profile (member role)
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

// PUT /members/me - update logged-in member's own allowed fields (member role)
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

// GET /members/:id - view one member profile (admin only, enforced at gateway)
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

// PUT /members/:id - update any member profile (admin only, enforced at gateway)
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

// DELETE /members/:id - remove member (admin only, enforced at gateway)
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
