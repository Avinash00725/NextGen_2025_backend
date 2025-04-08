const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const auth = require('../middleware/auth');
const Post = require('../models/Post');
const Notification = require('../models/Notification');

// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, file.mimetype.startsWith('image/') ? 'uploads/images' : 'uploads/videos');
  },
  filename: (req, file, cb) => {
    cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    // Allow all image and video MIME types
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      return cb(null, true);
    }
    cb(new Error('Only image or video files are allowed!'));
  },
}).fields([{ name: 'image', maxCount: 1 }, { name: 'video', maxCount: 1 }]);

// Get all community posts
router.get('/', async (req, res) => {
  try {
    const posts = await Post.find()
      .populate('user', 'name')
      .populate('comments.user', 'name')
      .sort({ createdAt: -1 });
    res.json(posts);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Create a new community post
router.post('/', auth, upload, async (req, res) => {
  const { content, mediaUrl } = req.body;
  const image = req.files?.image?.[0]
    ? `/uploads/images/${req.files.image[0].filename}`
    : '';
  const video = req.files?.video?.[0]
    ? `/uploads/videos/${req.files.video[0].filename}`
    : '';

  try {
    const post = new Post({
      user: req.user.id,
      content,
      image,
      video,
      ...(mediaUrl && {
        [isImageUrl(mediaUrl) ? 'image' : 'video']: mediaUrl,
      }),
      upvotes: 0,
      downvotes: 0,
      comments: [],
    });

    await post.save();
    const populatedPost = await Post.findById(post._id)
      .populate('user', 'name')
      .populate('comments.user', 'name');

    const io = req.app.get('socketio');
    io.emit('newPost', populatedPost);

    res.status(201).json(populatedPost);
  } catch (err) {
    console.error('Error creating post:', err);
    res.status(500).json({ message: err.message || 'Server error' });
  }
});

// Helper function to detect if a URL is an image
const isImageUrl = (url) => {
  return /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(url) || url.includes('gstatic.com/images');
};

// Upvote a post
router.post('/:id/upvote', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });

    post.upvotes += 1;
    await post.save();

    const populatedPost = await Post.findById(post._id)
      .populate('user', 'name')
      .populate('comments.user', 'name');

    const io = req.app.get('socketio');
    io.emit('postUpdated', populatedPost);

    res.json(populatedPost);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Downvote a post
router.post('/:id/downvote', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });

    post.downvotes += 1;
    await post.save();

    const populatedPost = await Post.findById(post._id)
      .populate('user', 'name')
      .populate('comments.user', 'name');

    const io = req.app.get('socketio');
    io.emit('postUpdated', populatedPost);

    res.json(populatedPost);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Add a comment to a post
router.post('/:id/comment', auth, async (req, res) => {
  const { text } = req.body;

  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });

    post.comments.push({ user: req.user.id, text });
    await post.save();

    const populatedPost = await Post.findById(post._id)
      .populate('user', 'name')
      .populate('comments.user', 'name');

    if (post.user.toString() !== req.user.id) {
      const notification = new Notification({
        user: post.user,
        message: `${populatedPost.user.name} commented on your post: "${text}"`,
      });
      await notification.save();

      const io = req.app.get('socketio');
      io.emit('newNotification', notification);
    }

    const io = req.app.get('socketio');
    io.emit('postUpdated', populatedPost); // Emit update to all clients

    res.json(populatedPost); // Return the updated post
  } catch (err) {
    console.error('Error adding comment:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete a post
router.delete('/:id', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });

    if (post.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await post.remove();

    const io = req.app.get('socketio');
    io.emit('postDeleted', req.params.id);

    res.json({ message: 'Post deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete a comment
router.delete('/:postId/comment/:commentId', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ message: 'Post not found' });

    const comment = post.comments.id(req.params.commentId);
    if (!comment) return res.status(404).json({ message: 'Comment not found' });

    if (comment.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    post.comments = post.comments.filter((c) => c._id.toString() !== req.params.commentId);
    await post.save();

    const populatedPost = await Post.findById(post._id)
      .populate('user', 'name')
      .populate('comments.user', 'name');

    const io = req.app.get('socketio');
    io.emit('postUpdated', populatedPost);

    res.json(populatedPost);
  } catch (err) {
    console.error('Error deleting comment:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;