const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = requrie('jsonwebtoken');

const dbConnect = require('./dbConnect');
const User = require('./models/user');
require('dotenv').config();

const app = express();
app.use(express.json());
dbConnect();

const JWT_SECRET = process.env.JWT_SECRET

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
        const.toke = n   
    } catch (err) {
        res
    }
})





//REG API
app.post('/reg', (req, res) => {
  console.log("REG API EXECUTED")
  bcrypt.hash(req.body.password, 10)
    .then(hashedPassword => {
      const pobj = new PersonModel({
        id: uniqueid(1000, 9999),
        name: req.body.name,
        email: req.body.email,
        password: hashedPassword,
        mobile: req.body.mobile,
        role: req.body.role
      });//CLOSE PersonModel
      
      //INSERT/SAVE THE RECORD/DOCUMENT
      pobj.save()
        .then(inserteddocument => {
          res.status(200).send('DOCUMENT INSERED IN MONGODB DATABASE');
        })//CLOSE THEN
        .catch(err => {
          res.status(500).send({ message: err.message || 'Error in Employee Save ' })
        });//CLOSE CATCH
    })
}//CLOSE CALLBACK FUNCTION BODY
);//CLOSE POST METHOD

// START THE EXPRESS SERVER. 5000 is the PORT NUMBER
app.listen(port, () => console.log(`EXPRESS Server Started at Port No: ${port}`));
