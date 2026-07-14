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

const memberSchema = new mongoose.Schema({
    userId: { type: String },
    name: { type: String },
    phone: { type: String },
    plan: { type: String },
    joinDate: { type: Date },
    isActive: { type: Boolean }
});

const Attendance = mongoose.model('Attendance', attendanceSchema);
const Member = mongoose.model('Member', memberSchema, 'members');

module.exports = {
    Attendance,
    Member
};
