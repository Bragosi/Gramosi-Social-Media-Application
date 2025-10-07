const express = require('express')
const {signUp, verifyAccount, ResendOTP}  = require('../controllers/authControllers')
const isAuthenticated = require('../middleware/isAuthenticated')



const router = express.Router()

router.post('/signUp', signUp)
router.post("/verify", isAuthenticated, verifyAccount)
router.post("/resendOtp", isAuthenticated, ResendOTP)


module.exports = router