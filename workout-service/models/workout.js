const mongoose = require('mongoose');

const exerciseSchema = new mongoose.Schema({
    name: { type: String },
    sets: { type: Number },
    reps: { type: Number },
}, { _id: false });

const workoutSchema = new mongoose.Schema({
    title:        { type: String, required: true },
    trainerId:    { type: String },
    description:  { type: String },
    difficulty:   { type: String, enum: ['beginner', 'intermediate', 'advanced'] },
    targetMuscle: { type: String, enum: ['chest', 'back', 'legs', 'arms', 'full body'] },
    exercises:    [exerciseSchema],
    createdAt:    { type: Date, default: Date.now },
});

module.exports = mongoose.model('Workout', workoutSchema);
