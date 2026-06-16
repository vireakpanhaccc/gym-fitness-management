const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
    memberId: { type: String, required: true },
    date: { type: Date, default: Date.now },
    checkInTime: { type: Date, default: Date.now },
    checkOutTime: { type: Date },
});

module.exports = mongoose.model('Attendance', attendanceSchema);
