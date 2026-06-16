const express = require('express');
const dbConnect = require('./dbConnect');
const Workout = require('./models/workout');
require('dotenv').config();

const app = express();
app.use(express.json());
dbConnect();

const PORT = process.env.PORT || 4005;

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'workout-service' }));

// POST /workouts
app.post('/workouts', async (req, res) => {
    try {
        const workout = await Workout.create(req.body);
        res.status(201).json({ message: 'Workout created', workout });
    } catch (err) {
        res.status(500).json({ message: 'Failed to create workout', error: err.message });
    }
});

// GET /workouts
app.get('/workouts', async (req, res) => {
    try {
        res.json(await Workout.find());
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch workouts', error: err.message });
    }
});

// GET /workouts/member/:memberId
app.get('/workouts/member/:memberId', async (req, res) => {
    try {
        res.json(await Workout.find({ memberId: req.params.memberId }));
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch workouts', error: err.message });
    }
});

// GET /workouts/:id
app.get('/workouts/:id', async (req, res) => {
    try {
        const workout = await Workout.findById(req.params.id);
        if (!workout) return res.status(404).json({ message: 'Workout not found' });
        res.json(workout);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch workout', error: err.message });
    }
});

// PUT /workouts/:id
app.put('/workouts/:id', async (req, res) => {
    try {
        const workout = await Workout.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!workout) return res.status(404).json({ message: 'Workout not found' });
        res.json({ message: 'Workout updated', workout });
    } catch (err) {
        res.status(500).json({ message: 'Failed to update workout', error: err.message });
    }
});

// DELETE /workouts/:id
app.delete('/workouts/:id', async (req, res) => {
    try {
        const workout = await Workout.findByIdAndDelete(req.params.id);
        if (!workout) return res.status(404).json({ message: 'Workout not found' });
        res.json({ message: 'Workout deleted' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to delete workout', error: err.message });
    }
});

app.listen(PORT, () => console.log(`workout-service running on PORT ${PORT}`));
