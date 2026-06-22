const mongoose = require('mongoose');
require('dotenv').config();

const clientOptions = {
    serverApi: {version: '1', strict: true, deprecationErrors: true}
};

async function dbConnect() {
    try {
        await mongoose.connect(process.env.uri, clientOptions);
        await mongoose.connection.db.admin().command({ ping: 1 });
        console.log('Attendance service connected to MongoDB');       
    } catch (err) {
        console.error('MongoDB connection failed:', err);
        process.exit(1);
    }
}

module.exports = dbConnect;