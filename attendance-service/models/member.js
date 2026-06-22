const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema({
    userId: { type: String },
    name: { type: String },
    phone: { type: String },
    plan: { type: String },
    joinDate: { type: Date },
    isActive: { type: Boolean }
});

module.exports = mongoose.model('Member', memberSchema, 'members');
