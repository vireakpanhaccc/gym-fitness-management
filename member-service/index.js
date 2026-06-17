const express = require('express');
const mongoose = require('mongoose');

const dbConnect = require('./dbConnect');
const Member = require('./models/member');
require('dotenv').config();

const app = express();
app.use(express.json());
dbConnect();

const port = process.env.PORT;

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
