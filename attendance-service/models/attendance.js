const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
    memberId: { 
        type: String, 
        required: true 
    },
    checkIn: {
        type: Date,
        default: Date.now
    },
    checkOut: {
        type: Date
    },
    duration: {
        type: Number,
    }
});

module.exports = mongoose.model('Attendance', attendanceSchema);
