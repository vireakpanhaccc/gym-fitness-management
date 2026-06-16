const mongoose = require('mongoose');

const exerciseSchema = new mongoose.Schema({
    name: { type: String, required: true },
    sets: { type: Number },
    reps: { type: Number },
}, { _id: false });

const workoutSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String },
    exercises: { type: [exerciseSchema], default: [] },
    difficulty: { type: String, enum: ['beginner', 'intermediate', 'advanced'], default: 'beginner' },
    trainerId: { type: String },
    memberId: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Workout', workoutSchema);
