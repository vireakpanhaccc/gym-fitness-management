const mongoose = require('mongoose');

const planSchema = new mongoose.Schema({
    name: { type: String, required: true },
    durationMonths: { type: Number, required: true },
    price: { type: Number, required: true },
    description: { type: String },
});

module.exports = mongoose.model('Plan', planSchema);
