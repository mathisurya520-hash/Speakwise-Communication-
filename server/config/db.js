const mongoose = require('mongoose');
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(
      process.env.MONGO_URI || 'mongodb://localhost:27017/speakwise_ai'
    );

    console.log(`MongoDB Connected: ${conn.connection.host}`);
    console.log(`MongoDB Ready State: ${mongoose.connection.readyState}`);
  } catch (error) {
    console.error(`Database Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;