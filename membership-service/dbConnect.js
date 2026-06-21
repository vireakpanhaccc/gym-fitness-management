const mongoose = require('mongoose');

const clientOptions = {
  serverApi: { version: '1', strict: true, deprecationErrors: true },
};

async function dbConnect() {
  try {
    await mongoose.connect(process.env.MONGO_URI, clientOptions);
    await mongoose.connection.db.admin().command({ ping: 1 });
    console.log('Membership service connected to MongoDB Atlas');
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  }
}

module.exports = dbConnect;
