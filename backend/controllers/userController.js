const UsersModel = require("../models/UserModel");
const AppError = require("../utils/AppError");
const CatchAsync = require("../utils/CatchAsync");
const { UploadToCloudinary } = require("../utils/cloudinary");
const GetDataUri = require("../utils/dataUrl");


 // ✅ Get Another User's Profile
const GetProfile = CatchAsync(async (req, res, next) => {
  const { id } = req.params;

  const user = await UsersModel.findById(id)
    .select(
      "-password -otp -otpExpires -resetPasswordOtp -resetPasswordOtpExpires -passwordConfirm"
    )
    .populate({
      path: "post",
      options: { sort: { createdAt: -1 } },
    })
    .populate({
      path: "savedPosts",
      options: { sort: { createdAt: -1 } },
    });

  if (!user) return next(new AppError("User not found", 404));

  res.status(200).json({
    status: "success",
    data: { user },
  });
});

// ✅ Edit Profile
const EditProfile = CatchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { bio } = req.body;
  const profilePicture = req.file;

  // Find the current user
  const user = await UsersModel.findById(userId).select("-password");
  if (!user) return next(new AppError("User not found", 404));

  // Upload new profile picture to Cloudinary (if provided)
  if (profilePicture) {
    const fileUri = GetDataUri(profilePicture);
    const cloudResponse = await UploadToCloudinary(fileUri);

    // remove old image from Cloudinary if you store public_id
    if (user.profilePicturePublicId) {
        await cloudinary.uploader.destroy(user.profilePicturePublicId);
        }

    user.profilePicture = cloudResponse.secure_url;
    user.profilePicturePublicId = cloudResponse.public_id;
  }

  // Update bio if provided
  if (bio) user.bio = bio;

  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    status: "success",
    message: "Profile updated successfully",
    data: { user },
  });
});

//✅ Suggested Users
const SuggestedUsers = CatchAsync(async (req, res, next) => {
  const loggedInUserId = req.user.id;

  const users = await UsersModel.find({ _id: { $ne: loggedInUserId } })
    .select(
      "-password -otp -otpExpires -resetPasswordOtp -resetPasswordOtpExpires -passwordConfirm"
    )
    .limit(10); // optional: limit suggestions for performance

  res.status(200).json({
    status: "success",
    results: users.length,
    data: { users },
  });
});

//✅ Follow or Unfollow a User
const FollowAndUnfollowUsers = CatchAsync(async (req, res, next) => {
  const loggedInUserId = req.user.id;
  const targetUserId = req.params.id;

  // Prevent self-follow
  if (loggedInUserId.toString() === targetUserId) {
    return next(new AppError("You cannot follow or unfollow yourself", 400));
  }

  const targetUser = await UsersModel.findById(targetUserId);
  if (!targetUser) return next(new AppError("User not found", 404));

  const isFollowing = targetUser.followers.includes(loggedInUserId);

  if (isFollowing) {
    // 🔹 Unfollow logic
    await Promise.all([
      UsersModel.updateOne(
        { _id: loggedInUserId },
        { $pull: { following: targetUserId } }
      ),
      UsersModel.updateOne(
        { _id: targetUserId },
        { $pull: { followers: loggedInUserId } }
      ),
    ]);
  } else {
    // 🔹 Follow logic
    await Promise.all([
      UsersModel.updateOne(
        { _id: loggedInUserId },
        { $addToSet: { following: targetUserId } }
      ),
      UsersModel.updateOne(
        { _id: targetUserId },
        { $addToSet: { followers: loggedInUserId } }
      ),
    ]);
  }

  const updatedLoggedInUser = await UsersModel.findById(loggedInUserId).select(
    "-password"
  );

  res.status(200).json({
    status: "success",
    message: isFollowing
      ? "You have unfollowed this user"
      : "You have followed this user",
    data: { user: updatedLoggedInUser },
  });
});

// ✅ Get Authenticated User Profile
const GetMyProfile = CatchAsync(async (req, res, next) => {
  const user = await UsersModel.findById(req.user.id).select(
    "-password -otp -otpExpires -resetPasswordOtp -resetPasswordOtpExpires -passwordConfirm"
  );

  if (!user) return next(new AppError("User not authenticated", 404));

  res.status(200).json({
    status: "success",
    message: "Authenticated user profile",
    data: { user },
  });
});

module.exports = {
  GetProfile,
  EditProfile,
  SuggestedUsers,
  FollowAndUnfollowUsers,
  GetMyProfile,
};
