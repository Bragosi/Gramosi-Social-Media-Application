const AppError = require("../utils/AppError");
const CatchAsync = require("../utils/CatchAsync");
const sharp = require("sharp");
const { UploadToCloudinary, cloudinary } = require("../utils/cloudinary");
const PostModel = require("../models/PostModel");
const UsersModel = require("../models/UserModel");
const CommentModel = require("../models/CommentModel");

// ✅Create Post Controller (Images + Videos)
const CreatePost = CatchAsync(async (req, res, next) => {
  const { caption } = req.body;
  const file = req.file; // Image or video
  const userId = req.user._id;

  if (!file) {
    return next(new AppError("Media (image or video) is required to post", 400));
  }

  const isImage = file.mimetype.startsWith('image/');
  const isVideo = file.mimetype.startsWith('video/');
  if (!isImage && !isVideo) {
    return next(new AppError("Invalid file type: Must be image or video", 400));
  }

  const mediaType = isImage ? 'image' : 'video';
  const resourceType = mediaType;

  let processedBuffer = file.buffer;
  let uploadFormat = file.mimetype.split('/')[1];
  let thumbnailUrl = null;

  if (isImage) {
    processedBuffer = await sharp(file.buffer)
      .resize({ width: 800, height: 800, fit: "inside" })
      .toFormat("jpeg", { quality: 80 })
      .toBuffer();
    uploadFormat = 'jpeg';
  } else if (isVideo) {
    processedBuffer = file.buffer;
  }

  const maxSizes = { image: 10 * 1024 * 1024, video: 100 * 1024 * 1024 };
  if (file.size > maxSizes[mediaType]) {
    return next(new AppError(`${mediaType} too large (max ${maxSizes[mediaType] / (1024*1024)}MB)`, 400));
  }

  const fileUri = `data:${file.mimetype};base64,${processedBuffer.toString("base64")}`;
  const uploadOptions = { 
    resource_type: resourceType,
    format: uploadFormat,
  };
  if (isVideo) {
    uploadOptions.eager = [{ 
      video_sampling_ratio: 2,
      format: 'jpg', 
      quality: 80,
      crop: 'fill',
      width: 400,
      height: 300 
    }];
  }
  const cloudResponse = await UploadToCloudinary(fileUri, uploadOptions);

  if (isVideo && cloudResponse.eager && cloudResponse.eager.length > 0) {
    thumbnailUrl = cloudResponse.eager[0].secure_url;
  }

  let post = await PostModel.create({
    caption,
    media: {
      url: cloudResponse.secure_url,
      publicId: cloudResponse.public_id,
      type: mediaType,
      thumbnailUrl
    },
    user: userId,
  });

  // Add Post to User Posts (atomic update)
  await UsersModel.findByIdAndUpdate(userId, { $push: { posts: post._id } }, { validateBeforeSave: false });

  post = await PostModel.findById(post._id).populate({
    path: "user",
    select: "userName email bio profilePicture",
  });
  return res.status(201).json({
    status: "success",
    message: "Post Created",
    data: { post },
  });
});

// ✅Get All Post Controller (No change)
const GetAllPost = CatchAsync(async (req, res, next) => {
  const posts = await PostModel.find()
    .populate({
      path: "user",
      select: "userName profilePicture bio",
    })
    .populate({
      path: "comments",
      select: "text user",
      populate: {
        path: "user",
        select: "userName profilePicture",
      },
    })
    .sort({ createdAt: -1 });

  return res.status(200).json({
    status: "success",
    result: posts.length,
    data: { posts },
  });
});

// ✅Get User Post Controller (No change)
const GetUserPost = CatchAsync(async (req, res, next) => {
  const userId = req.params.id;

  const posts = await PostModel.find({ user: userId })
    .populate({
      path: "user",
      select: "userName profilePicture bio",
    })
    .populate({
      path: "comments",
      select: "text user",
      populate: {
        path: "user",
        select: "userName profilePicture",
      },
    })
    .sort({ createdAt: -1 });

  return res.status(200).json({
    status: "success",
    results: posts.length,
    data: { posts },
  });
});

// ✅Save and Unsave Post Controller (No change)
const SaveOrUnsavePost = CatchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const postId = req.params.postId;

  const user = await UsersModel.findById(userId);

  if (!user) {
    return next(new AppError("User not found", 404));
  }
  const isPostSaved = user.savedPosts.includes(postId);
  if (isPostSaved) {
    user.savedPosts.pull(postId);
    await user.save({ validateBeforeSave: false });
    return res.status(200).json({
      status: "success",
      message: "You've Unsaved this post",
      data: { savedPosts: user.savedPosts },
    });
  } else {
    user.savedPosts.push(postId);
    await user.save({ validateBeforeSave: false });
    return res.status(200).json({
      status: "success",
      message: "This post have been saved",
      data: { savedPosts: user.savedPosts },
    });
  }
});

// ✅Delete Post Controller (Updated for video type)
const DeletePost = CatchAsync(async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user._id;

  const post = await PostModel.findById(id).populate("user");
  if (!post) {
    return next(new AppError("Post not found", 404));
  }
  if (post.user._id.toString() !== userId.toString()) {
    return next(new AppError("You're not authorized to delete this post", 403));
  }
  // Remove the post from user post
  await UsersModel.updateOne({ _id: userId }, { $pull: { posts: id } });

  // Remove this post from users saved list
  await UsersModel.updateMany(
    { savedPosts: id },
    { $pull: { savedPosts: id } }
  );

  // Remove the comments on post
  await CommentModel.deleteMany({ post: id });

  // Remove media from Cloudinary (image or video)
  if (post.media.publicId) {
    await cloudinary.uploader.destroy(post.media.publicId, { 
      resource_type: post.media.type 
    });
  }
  // Remove the post
  await PostModel.findByIdAndDelete(id);

  res.status(200).json({
    status: "success",
    message: "This Post have been Deleted",
  });
});

// ✅Like and Dislike Post Controller (No change)
const LikeAndDislikePost = CatchAsync(async (req, res, next) => {
  const postId = req.params.id;
  const userId = req.user._id;

  const post = await PostModel.findById(postId);
  if (!post) return next(new AppError("Post not found", 404));
  const isLiked = post.likes.includes(userId);

  if (isLiked) {
    await PostModel.findByIdAndUpdate(
      postId,
      { $pull: { likes: userId } },
      { new: true }
    );
    return res.status(200).json({
      status: "success",
      message: "Post Disliked",
    });
  } else {
    await PostModel.findByIdAndUpdate(
      postId,
      { $addToSet: { likes: userId } },
      { new: true }
    );
    return res.status(200).json({
      status: "success",
      message: "Post Liked",
    });
  }
});

// ✅Add Comment Post Controller (No change)
const AddComment = CatchAsync(async (req, res, next) => {
  const { id: postId } = req.params;
  const userId = req.user._id;
  const { text } = req.body;
  const post = await PostModel.findById(postId);
  if (!post) return next(new AppError("Post not found", 404));
  if (!text) return next(new AppError("Comment text is required", 400));
  const comment = await CommentModel.create({
    text,
    user: userId,
    post: postId,
    createdAt: Date.now(),
  });
  post.comments.push(comment._id);
  await post.save({ validateBeforeSave: false });
  await comment.populate({
    path: "user",
    select: "userName profilePicture bio",
  });

  res.status(201).json({
    status: "success",
    message: "Your comment have been Sent",
    data: { comment },
  });
});

module.exports = {
  CreatePost,
  GetAllPost,
  GetUserPost,
  SaveOrUnsavePost,
  DeletePost,
  LikeAndDislikePost,
  AddComment,
};