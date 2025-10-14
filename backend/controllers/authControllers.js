const UsersModel = require('../models/UserModel');
const CatchAsync = require('../utils/CatchAsync');
const GenerateOtp = require('../utils/GenerateOtp');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const hbs = require('hbs');
const AppError = require('../utils/AppError');
const sendEmail = require('../utils/email');

// ✅ Load email template function
const loadTemplate = (templateName, replacements) => {
  // Locate the file inside /emailTemplates directory
  const templatePath = path.join(__dirname, '../emailTemplates', `${templateName}.hbs`);
 
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

if (!userName || !email || !password || !passwordConfirm) {
  return next(new AppError("Please fill all fields", 400));
}
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
    await sendEmail({
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

// ✅ Verify account Controller
const verifyAccount = CatchAsync(async (req, res, next)=>{
  const {otp} = req.body
  if(!otp){
    return next(new AppError ("Otp is required for verification", 400))
  }
const user = req.user
if(user.otp !==otp){
  return next(new AppError("Invalid OTP", 400))
}
if(Date.now()> user.otpExpires){
  return next(new AppError ("OTP has expired, Request for a new OTP", 400))
}
user.isVerified = true
user.otp = undefined
user.otpExpires = undefined

await user.save({validateBeforeSave : false})

createSendToken(user, 200, res, "Email has been verified")
})

// ✅ Resend OTP Controller
const ResendOTP = CatchAsync(async (req, res, next) => {
  const { email } = req.user;
  if (!email) {
    return next(new AppError("Email is required", 400));
  }

  const user = await UsersModel.findOne({ email });
  if (!user) {
    return next(new AppError("User not found", 404));
  }

  if (user.isVerified) {
    return next(new AppError("This account is already verified", 400));
  }

  const otp = GenerateOtp();
  const otpExpires = Date.now() + 24 * 60 * 60 * 1000;

  user.otp = otp;
  user.otpExpires = otpExpires;

  await user.save({ validateBeforeSave: false });

  const htmlTemplate = loadTemplate('otpTemplate', {
    title: 'OTP Verification',
    userName: user.userName,
    otp,
    message: 'Your one-time password (OTP) for account verification is:',
  });

  try {
    await sendEmail({
      email: user.email,
      subject: 'Resend OTP Verification',
      html: htmlTemplate,
    });

    res.status(200).json({
      status: 'success',
      message: 'A new OTP has been sent to your email.',
    });
  } catch (error) {
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save({ validateBeforeSave: false });
    return next(new AppError("There was an error resending OTP. Please try again later.", 500));
  }
});

// ✅Login Controller
const Login = CatchAsync(async (req, res,next)=>{
  const {identifier, password} = req.body
  if(!identifier || !password){
    return next(new AppError("Please Provide Email/Username and Password", 400))
  }
  const user = await UsersModel.findOne({
    $or : [{email : identifier}, {userName : identifier}]
  }).select("+password")

if (!user) {
  return next(new AppError("Incorrect Email or Password", 401));
}
if (!user.isVerified) {
  return next(new AppError("Please verify your email before logging in.", 401));
}
  if(!user || !(await user.correctPassword(password, user.password))){
    return next(new AppError("Incorrect Email or Password", 401))
  }
  createSendToken(user, 200, res, "Login Successful")
})

// ✅Logout Controller
const Logout = CatchAsync(async (req, res, next)=>{
  res.cookie("token", "loggedout",{
    expires : new Date(Date.now() + 10 * 1000),
    httpOnly : true,
    secure : process.env.NODE_ENV === 'production'
  })
  res.status(200).json({
    status: 'success',
    message : "Logged Out Successful"
  })
})

// ✅Forgot Password Controller
const ForgotPassword = CatchAsync(async (req, res, next)=>{
const {identifier} = req.body
const user = await UsersModel.findOne({
  $or :  [{email : identifier}, {userName : identifier}]
})
if(!user){
  return next(new AppError("No User Found", 404))
}
const otp = GenerateOtp()
const resetExpires = Date.now()+ 300000 

user.resetPasswordOTP=otp
user.resetPasswordOTPExpires=resetExpires

await user.save({validateBeforeSave : false })

const htmlTemplate = loadTemplate("otpTemplate", {
  title: "Reset Passoword OTP",
  userName : user.userName,
  otp,
  message: "Your Password Reset OTp is : "
})
try {
  await sendEmail({
    email : user.email,
    subject : "Password reset otp (Valid for 5min)",
    html : htmlTemplate
  })
  res.status(200).json({
    status : "success",
    message : "Password reset otp is sent to your email"
  })
} catch (error) {
  user.resetPasswordOTP=undefined,
  user.resetPasswordOTPExpires=undefined
  await user.save({validateBeforeSave : false})
  return next(
    new AppError("There was an error sending the email. Try again Later!", 500)
  )
}
})

// ✅Reset Password Controller
const ResetPassword = CatchAsync(async (req, res,next)=>{
  const {identifier, otp, password, passwordConfirm}= req.body
  const user = await UsersModel.findOne({
    $or :
    [{email : identifier}, {userName : identifier}],
    resetPasswordOTP : otp,
    resetPasswordOTPExpires : {$gt: Date.now()}
  })
  if (!user){
    return next(new AppError("No User Found", 400))
  }
  user.password=password
  user.passwordConfirm=passwordConfirm
  user.resetPasswordOTP=undefined 
  user.resetPasswordOTPExpires=undefined
  await user.save()
  createSendToken(user, 200, res, 'Password Reset Successful')
})

// ✅Change Password Controller
const ChangePassword = CatchAsync(async (req, res, next) => {
  const { currentPassword, newPassword, newPasswordConfirm } = req.body;
  const { email } = req.user;

  const user = await UsersModel.findOne({ email }).select('+password');

  if (!user) {
    return next(new AppError('User not found', 404));
  }

  const isPasswordCorrect = await user.correctPassword(currentPassword, user.password);
  if (!isPasswordCorrect) {
    return next(new AppError('Incorrect current password', 400));
  }

  if (newPassword !== newPasswordConfirm) {
    return next(new AppError("New password and confirm password don't match", 400));
  }

  user.password = newPassword;
  user.passwordConfirm = newPasswordConfirm;
  await user.save();

  createSendToken(user, 200, res, 'Password has been successfully changed');
});

// Export Controllers
module.exports = {
  signUp, 
  verifyAccount,
  ResendOTP,
  Login,
  Logout,
  ForgotPassword,
  ResetPassword,
  ChangePassword
}