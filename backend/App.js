const express = require('express');
const morgan = require('morgan');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const path = require('path');
const AppError = require('./utils/AppError');
const userRouter = require('./routes/UserRoutes');
const globalErrorHandler = require('./controllers/errorController'); 

const app = express();

app.use('/uploads', express.static('uploads')); // For user uploads
app.use(express.static(path.join(__dirname, 'public'))); // For static assets

app.use(cookieParser());
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: process.env.NODE_ENV === 'production' ? ['https://yourdomain.com'] : ['http://localhost:3000'],
    credentials: true,
  })
);

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

app.use(express.json({ limit: '10kb' }));
app.use(mongoSanitize());

// Routes
app.use('/api/v1/users', userRouter);

// TODO: Implement post routes
// app.use('/api/v1/posts', postRouter);

// 404 handler
// 404 handler (must come after all routes)
app.all('*', (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl}`, 404));
});


// Global error handler
app.use(globalErrorHandler);

module.exports = app;