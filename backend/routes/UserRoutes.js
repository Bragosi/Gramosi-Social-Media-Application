const express = require('express')
const {signUp, verifyAccount, ResendOTP, Login, Logout, ForgotPassword, ResetPassword, ChangePassword, }  = require('../controllers/authControllers')
const isAuthenticated = require('../middleware/isAuthenticated')
const { GetProfile, EditProfile, SuggestedUsers, FollowAndUnfollowUsers, GetMyProfile } = require('../controllers/userController')
const upload = require('../middleware/multer')



const router = express.Router()
// ✅ Auth  Routes
router.post('/signUp', signUp)
router.post("/verify", isAuthenticated, verifyAccount)
router.post("/resendOtp", isAuthenticated, ResendOTP)
router.post("/login", Login)
router.post("/logout", Logout)
router.post("/forgotPassword", ForgotPassword)
router.post("/resetPassword", ResetPassword)
router.post("/changePassword", isAuthenticated, ChangePassword)

// ✅ User  Routes
router.get("/profile/:id", GetProfile)
router.post("/editProfile", isAuthenticated, upload.single('profilePicture'), EditProfile)
router.get("/suggestedUsers", isAuthenticated, SuggestedUsers)
router.post("/followAndUnfollow/:id", isAuthenticated, FollowAndUnfollowUsers)
router.post("/myProfile", isAuthenticated, GetMyProfile)
module.exports = router