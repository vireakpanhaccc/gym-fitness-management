const mongoose = require('mongoose');

const trainerSchema = new mongoose.Schema({
    userId:          { type: String },
    name:            { type: String, required: true },
    specialization:  { type: String },
    bio:             { type: String },
    experienceYears: { type: Number },
    isAvailable:     { type: Boolean, default: true },
    createdAt:       { type: Date, default: Date.now },
});

module.exports = mongoose.model('Trainer', trainerSchema);
