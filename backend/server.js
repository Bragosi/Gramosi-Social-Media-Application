const dotenv = require('dotenv');
const mongoose = require('mongoose');

process.on('uncaughtException', (err) => {
  console.log('UNCAUGHT EXCEPTION! Shutting down');
  console.log(err.name, err.message);
  process.exit(1);
});

dotenv.config({ path: './config.env' });

const app = require('./App');

mongoose
  .connect(process.env.DB)
  .then(() => {
    console.log('DB connected');
  })
  .catch((err) => {
    console.error('Database connection error:', err);
    process.exit(1);
  });

const port = process.env.PORT || 8000;

const server = app.listen(port, () => {
  console.log(`App is running on port ${port}`);
});

process.on('unhandledRejection', (err) => {
  console.log('UNHANDLED REJECTION! Shutting Down');
  console.log(err.name, err.message); 
  server.close(() => {
    process.exit(1);
  });
});