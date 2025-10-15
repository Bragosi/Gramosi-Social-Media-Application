const express = require('express')
const isAuthenticated = require('../middleware/isAuthenticated')
const upload = require('../middleware/multer')
const { CreatePost, GetAllPost, GetUserPost, SaveOrUnsavePost, DeletePost, LikeAndDislkePost, AddComment } = require('../controllers/postController')

const router = express.Router()

router.post("/createPost", isAuthenticated, upload.single('image'), CreatePost)
router.get("/all", GetAllPost)
router.get("/userPost/:id", GetUserPost)
router.post("/saveAndUnsavePosts/:postId", isAuthenticated, SaveOrUnsavePost )
router.delete("/deletePost/:id", isAuthenticated, DeletePost)
router.post("/likeAndDislikePost/:id", isAuthenticated, LikeAndDislkePost)
router.post("/comment/:id", isAuthenticated, AddComment)
module.exports =router