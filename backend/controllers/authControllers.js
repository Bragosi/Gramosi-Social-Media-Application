const UsersModel = require('../models/UserModel');
const CatchAsync = require('../utils/CatchAsync');
const GenerateOtp = require('../utils/GenerateOtp');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const hbs = require('hbs');
const AppError = require('../utils/AppError');
const SendEmail = require('../utils/email');

// ✅ Load email template function
const loadTemplate = (templateName, replacements) => {
  // Locate the file inside /emailTemplates directory
  const templatePath = path.join(__dirname, '../emailTemplates', `${templateName}.hbs`);

  console.log('📂 Loading template from:', templatePath); // Debug log

  // Check if the file actually exists before reading it
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template not found: ${templatePath}`);
  }

  const source = fs.readFileSync(templatePath, 'utf-8');
  const template = hbs.compile(source);
  return template(replacements);
};

// ✅ Generate JWT Token
const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

// ✅ Send token + response
const createSendToken = (user, statusCode, res, message) => {
  const token = signToken(user._id);

  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
  };

  res.cookie('token', token, cookieOptions);

  // Hide sensitive data before sending response
  user.password = undefined;
  user.otp = undefined;

  res.status(statusCode).json({
    status: 'success',
    message,
    token,
    data: { user },
  });
};

// ✅ User Signup Controller
const signUp = CatchAsync(async (req, res, next) => {
  const { email, password, passwordConfirm, userName } = req.body;

  // Check for duplicate email or username
  const existingUser = await UsersModel.findOne({
    $or: [{ email }, { userName }],
  });

  if (existingUser) {
    return next(
      new AppError(
        existingUser.email === email
          ? 'User with this email already exists'
          : 'Username is already taken',
        400
      )
    );
  }

  // Generate OTP and expiry
  const otp = GenerateOtp();
  const otpExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

  // Create new user
  const newUser = await UsersModel.create({
    userName,
    email,
    password,
    passwordConfirm,
    otp,
    otpExpires,
  });

  // ✅ Load and compile OTP email template
  const htmlTemplate = loadTemplate('otpTemplate', {
    title: 'OTP Verification',
    userName: newUser.userName,
    otp,
    message: 'Your one-time password (OTP) for account verification is:',
  });

  try {
    // ✅ Send OTP email
    await SendEmail({
      email: newUser.email,
      subject: 'OTP for Email Verification',
      html: htmlTemplate,
    });

    // ✅ Send success response
    createSendToken(
      newUser,
      201,
      res,
      'Registration successful. Check your email for OTP verification.'
    );
  } catch (error) {
    // Delete user if email fails to send
    await UsersModel.findByIdAndDelete(newUser._id);
    return next(new AppError('Error sending OTP. Please try again later.', 500));
  }
});

module.exports = signUp;
