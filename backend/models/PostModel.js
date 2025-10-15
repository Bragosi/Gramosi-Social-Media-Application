const mongoose = require("mongoose");

const postSchema = new mongoose.Schema(
  {
    caption: {
      type: String,
      maxlenght: [2200, "Captions should be less than 2200 characters"],
      trim: true,
    },
    media: {
      url: { type: String, required: true },
      publicId: { type: String, required: true },
      type: { type: String, enum: ["image", "video"], required: true },
      thumbnailUrl: String,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User Id is Required"],
    },
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    comments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Comment",
      },
    ],
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);
postSchema.index({ user: 1, createdAt: -1 });

const PostModel = mongoose.model("Post", postSchema);

module.exports = PostModel;
