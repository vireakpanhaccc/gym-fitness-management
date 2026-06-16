const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const dbConnect = require('./dbConnect');
const User = require('./models/user');
require('dotenv').config();

const app = express();
app.use(express.json());
dbConnect();

const JWT_SECRET = process.env.JWT_SECRET
const port = process.env.PORT;

// POST /register
app.post('/register', async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        const existing = await User.findOne({ email });
        if (existing) return res.status(400).json({ message: 'Email already registered;'});
        const hashed = await bcrypt.hash(password, 10);
        const user = await User.create({ name, email, password: hashed, role });
        res.status(201).json({ message: 'User registered successfully', user: { id: user._id, name, email, role: user.role }});
    } catch (err) {
        res.status(500).json({ message: 'Registration failed', error: err.message});
    }
});

// POST /login 
app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(401).json({ message: 'Invalid credentials'});
        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(401).json({ message: 'Invalid credentials'}); 
        const token = jwt.sign(
          { id: user._id, name: user.name, email: user.email, role: user.role },
          JWT_SECRET,
          { expiresIn: '24h' }
        );
        res.json({ message: 'Login successful', token });
    } catch (err) {
        res.status(500).json({message: 'Login failed', error: err.message});
    }
})

// GET /users - get all users
app.get('/users', async (req, res) => {
    try {
        const users = await User.find().select('-password');
        res.json(users);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch users', error: err.message });
    }
})

// DELETE /users/:id - Delete specific user by ID
app.delete('/users/:id', async(req, res) => {
    try {
        await User.findByIdAndDelete(req.params.id);
        res.json({ message: 'User deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to delete user', error: err.message });
    }
  });

// START THE EXPRESS SERVER. 3001 is the PORT NUMBER
app.listen(port, () => console.log(`EXPRESS Server Started at Port No: ${port}`));
