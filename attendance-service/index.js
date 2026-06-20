const express = require('express');
const mongoose = require('mongoose');

const dbConnect = require('./dbConnect');
const Attendance = require('./models/attendance');
require('dotenv').config();

const app = express();
app.use(express.json());
dbConnect();

const port = process.env.PORT;

function calculateDurationMinutes(checkIn, checkOut) {
    return Math.max(0, Math.ceil((checkOut.getTime() - checkIn.getTime()) / 60000));
}

// POST /checkin - log gym entry for a member
app.post('/checkin', async (req, res) => {
    try {
        const memberId = req.body.memberId || req.headers['x-member-id'] || req.headers['x-user-id'];
        if (!memberId) {
            return res.status(400).json({ message: 'memberId is required' });
        }

        const openAttendance = await Attendance.findOne({ memberId, checkOut: { $exists: false } });
        if (openAttendance) {
            return res.status(400).json({ message: 'Member already has an open attendance record' });
        }

        const attendance = await Attendance.create({ memberId });
        res.status(201).json({ message: 'Check-in successful', attendance });
    } catch (err) {
        res.status(500).json({ message: 'Failed to check in', error: err.message });
    }
});

// PUT /checkout/me - close the logged-in member's latest open attendance record
app.put('/checkout/me', async (req, res) => {
    try {
        const memberId = req.body.memberId || req.headers['x-member-id'] || req.headers['x-user-id'];
        if (!memberId) {
            return res.status(400).json({ message: 'memberId is required' });
        }

        const attendance = await Attendance.findOne({ memberId, checkOut: { $exists: false } })
            .sort({ checkIn: -1 });
        if (!attendance) {
            return res.status(404).json({ message: 'No open attendance record found' });
        }

        const checkOut = new Date();
        attendance.checkOut = checkOut;
        attendance.duration = calculateDurationMinutes(attendance.checkIn, checkOut);
        await attendance.save();

        res.json({ message: 'Check-out successful', attendance });
    } catch (err) {
        res.status(500).json({ message: 'Failed to check out', error: err.message });
    }
});

// PUT /checkout/:id - admin closes a specific attendance record
app.put('/checkout/:id', async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Invalid attendance ID' });
        }

        const attendance = await Attendance.findById(req.params.id);
        if (!attendance) {
            return res.status(404).json({ message: 'Attendance record not found' });
        }
        if (attendance.checkOut) {
            return res.status(400).json({ message: 'Attendance record is already checked out' });
        }

        const checkOut = new Date();
        attendance.checkOut = checkOut;
        attendance.duration = calculateDurationMinutes(attendance.checkIn, checkOut);
        await attendance.save();

        res.json({ message: 'Check-out successful', attendance });
    } catch (err) {
        res.status(500).json({ message: 'Failed to check out', error: err.message });
    }
});

// GET /attendance/me - view the logged-in member's visit history
app.get('/attendance/me', async (req, res) => {
    try {
        const memberId = req.headers['x-member-id'] || req.headers['x-user-id'];
        if (!memberId) {
            return res.status(400).json({ message: 'memberId is required' });
        }

        const attendance = await Attendance.find({ memberId }).sort({ checkIn: -1 });
        res.json(attendance);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch attendance history', error: err.message });
    }
});

// GET /attendance/member/:memberId - view one member's visit history
app.get('/attendance/:memberId', async (req, res) => {
    try {
        const attendance = await Attendance.find({ memberId: req.params.memberId }).sort({ checkIn: -1 });
        res.json(attendance);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch member attendance history', error: err.message });
    }
});

// GET /attendance - view all attendance logs
app.get('/attendance', async (req, res) => {
    try {
        const attendance = await Attendance.find().sort({ checkIn: -1 });
        res.json(attendance);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch attendance logs', error: err.message });
    }
});

app.listen(port, () => console.log(`Attendance service started at port ${port}`));
