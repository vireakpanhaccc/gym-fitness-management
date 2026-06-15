const mongoose = require('mongoose');
require('dotenv').config();

const clientOptions = { 
    serverApi: { version: '1', strict: true, deprecationErrors: true } 
};

async function dbConnect() {
  try {
    // Create a Mongoose client with a MongoClientOptions object to set the Stable API version
    // STEP-2 : ESTABLISH CONNECTION WITH MONGODB DATABASE THROUGH MONGOOSE
    await mongoose.connect(process.env.uri, clientOptions);
    await mongoose.connection.db.admin().command({ ping: 1 });
    console.log("Pinged your deployment. Successfully connected to MongoDB!");
  } catch (err) {
    console.error('MongoDB connection failed:', err);
    process.exit(1);
  }
}

module.exports = dbConnect;
