const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: {type: String},
    email: {type: String, required:true, unique:true},
    password: {type: String, required:true},
    role: {type: String, enum: ['admin', 'trainer', 'member'], default: 'member'},
    createdAt: {type: Date, default: Date.now},
})

module.exports = mongoose.model('User', userSchema);