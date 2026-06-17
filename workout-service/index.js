const express = require('express');
const mongoose = require('mongoose');

const dbConnect = require('./dbConnect');
const Workout = require('./models/workout');
require('dotenv').config();

const app = express();
app.use(express.json());
dbConnect();

const port = process.env.PORT;

// POST /workouts - create workout plan (trainer + admin, enforced at gateway)
app.post('/workouts', async (req, res) => {
    try {
        const trainerId = req.headers['x-user-id'];
        const workout = await Workout.create({ ...req.body, trainerId });
        res.status(201).json({ message: 'Workout created successfully', workout });
    } catch (err) {
        res.status(500).json({ message: 'Failed to create workout', error: err.message });
    }
});

// GET /workouts - list all workouts (all roles)
app.get('/workouts', async (req, res) => {
    try {
        const workouts = await Workout.find();
        res.json(workouts);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch workouts', error: err.message });
    }
});

// GET /workouts/my - list workouts created by the logged-in trainer (trainer role)
app.get('/workouts/my', async (req, res) => {
    try {
        const trainerId = req.headers['x-user-id'];
        const workouts = await Workout.find({ trainerId });
        res.json(workouts);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch workouts', error: err.message });
    }
});

// GET /workouts/:id - view one workout (all roles)
app.get('/workouts/:id', async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Invalid workout ID' });
        }
        const workout = await Workout.findById(req.params.id);
        if (!workout) return res.status(404).json({ message: 'Workout not found' });
        res.json(workout);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch workout', error: err.message });
    }
});

// PUT /workouts/:id - update workout (trainer must own it, admin can update any)
app.put('/workouts/:id', async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Invalid workout ID' });
        }
        const workout = await Workout.findById(req.params.id);
        if (!workout) return res.status(404).json({ message: 'Workout not found' });

        const role = req.headers['x-user-role'];
        const userId = req.headers['x-user-id'];
        if (role === 'trainer' && workout.trainerId !== userId) {
            return res.status(403).json({ message: 'Unauthorized: you do not own this workout' });
        }

        const updated = await Workout.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });
        res.json({ message: 'Workout updated successfully', workout: updated });
    } catch (err) {
        res.status(500).json({ message: 'Failed to update workout', error: err.message });
    }
});

// DELETE /workouts/:id - delete workout (admin only, enforced at gateway)
app.delete('/workouts/:id', async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Invalid workout ID' });
        }
        const workout = await Workout.findByIdAndDelete(req.params.id);
        if (!workout) return res.status(404).json({ message: 'Workout not found' });
        res.json({ message: 'Workout deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to delete workout', error: err.message });
    }
});

app.listen(port, () => console.log(`Workout service started at port ${port}`));
