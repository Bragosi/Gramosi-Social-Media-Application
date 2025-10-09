const express = require('express')
const {signUp, verifyAccount, ResendOTP, Login, Logout, ForgotPassword, ResetPassword, ChangePassword, }  = require('../controllers/authControllers')
const isAuthenticated = require('../middleware/isAuthenticated')



const router = express.Router()

router.post('/signUp', signUp)
router.post("/verify", isAuthenticated, verifyAccount)
router.post("/resendOtp", isAuthenticated, ResendOTP)
router.post("/login", Login)
router.post("/logout", Logout)
router.post("/forgotPassword", ForgotPassword)
router.post("/resetPassword", ResetPassword)
router.post("/changePassword", isAuthenticated, ChangePassword)

module.exports = router