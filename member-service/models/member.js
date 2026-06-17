const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema({
    userId: { type: String },
    name: { type: String, required: true },
    phone: { type: String },
    plan: {
        type: String,
        enum: ['basic', 'premium', 'vip'],
        default: 'basic'
    },
    joinDate: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true }
});

module.exports = mongoose.model('Member', memberSchema);
