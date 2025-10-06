const jwt = require('jsonwebtoken');
const CatchAsync = require('../utils/CatchAsync');
const AppError = require('../utils/AppError');
const UsersModel = require('../models/UserModel');

const isAuthenticated = CatchAsync(async (req, res, next) => {
  const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
  if (!token) {
    return next(new AppError('You are not logged in! Please login to gain access.', 401));
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const currentUser = await UsersModel.findById(decoded.id);

  if (!currentUser) {
    return next(new AppError('User does not exist', 401));
  }

  req.user = currentUser;
  next();
});

module.exports = isAuthenticated;