const express = require('express');
const dbConnect = require('./dbConnect');
const Attendance = require('./models/attendance');
require('dotenv').config();

const app = express();
app.use(express.json());
dbConnect();

const PORT = process.env.PORT || 4006;

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'attendance-service' }));

// POST /attendance/checkin
app.post('/attendance/checkin', async (req, res) => {
    try {
        const { memberId } = req.body;
        if (!memberId) return res.status(400).json({ message: 'memberId is required' });
        const record = await Attendance.create({ memberId, checkInTime: new Date() });
        res.status(201).json({ message: 'Checked in', record });
    } catch (err) {
        res.status(500).json({ message: 'Failed to check in', error: err.message });
    }
});

// PUT /attendance/checkout/:id
app.put('/attendance/checkout/:id', async (req, res) => {
    try {
        const record = await Attendance.findByIdAndUpdate(
            req.params.id,
            { checkOutTime: new Date() },
            { new: true }
        );
        if (!record) return res.status(404).json({ message: 'Attendance record not found' });
        res.json({ message: 'Checked out', record });
    } catch (err) {
        res.status(500).json({ message: 'Failed to check out', error: err.message });
    }
});

// GET /attendance
app.get('/attendance', async (req, res) => {
    try {
        res.json(await Attendance.find());
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch attendance', error: err.message });
    }
});

// GET /attendance/member/:memberId
app.get('/attendance/member/:memberId', async (req, res) => {
    try {
        res.json(await Attendance.find({ memberId: req.params.memberId }));
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch attendance', error: err.message });
    }
});

app.listen(PORT, () => console.log(`attendance-service running on PORT ${PORT}`));
