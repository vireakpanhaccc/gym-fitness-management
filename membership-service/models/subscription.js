const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
    memberId: { type: String, required: true },
    planId: { type: String, required: true },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date },
    status: { type: String, enum: ['active', 'expired', 'cancelled'], default: 'active' },
    paymentStatus: { type: String, enum: ['paid', 'pending'], default: 'pending' },
});

module.exports = mongoose.model('Subscription', subscriptionSchema);
