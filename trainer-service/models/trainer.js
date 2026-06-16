const mongoose = require('mongoose');

const trainerSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String },
    specialization: { type: String },
    experienceYears: { type: Number, default: 0 },
    availability: { type: String },
});

module.exports = mongoose.model('Trainer', trainerSchema);
