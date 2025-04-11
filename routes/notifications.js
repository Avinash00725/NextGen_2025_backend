// const express = require('express');
// const router = express.Router();
// const auth = require('../middleware/auth');
// const Notification = require('../models/Notification');

// // Get notifications for the logged-in user
// router.get('/', auth, async (req, res) => {
//   try {
//     const notifications = await Notification.find({ user: req.user.id })
//       .populate('user', 'name') // Ensure user is populated
//       .sort({ createdAt: -1 })
//       .limit(5);
//     console.log('Notifications fetched:', notifications); // Debug
//     res.json(notifications);
//   } catch (err) {
//     console.error('Error fetching notifications:', err);
//     res.status(500).json({ message: 'Server error' });
//   }
// });

// // Create a new notification (e.g., triggered by likes or comments)
// router.post('/', auth, async (req, res) => {
//   const { message, userId } = req.body;

//   try {
//     const notification = new Notification({
//       user: userId || req.user.id, // Use provided userId or current user
//       message,
//     });

//     await notification.save();
//     const populatedNotification = await Notification.findById(notification._id).populate('user', 'name');
//     console.log('New notification created:', populatedNotification); // Debug
//     res.status(201).json(populatedNotification);
//   } catch (err) {
//     console.error('Error creating notification:', err);
//     res.status(500).json({ message: 'Server error' });
//   }
// });

// module.exports = router;

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Notification = require('../models/Notification');
const User = require('../models/User'); // Added to fetch commenter details

// Get notifications for the logged-in user
router.get('/', auth, async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user.id })
      .populate('user', 'name') // Populates the recipient, though not used in message
      .sort({ createdAt: -1 })
      .limit(5);
    console.log('Notifications fetched:', notifications); // Debug
    res.json(notifications);
  } catch (err) {
    console.error('Error fetching notifications:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create a new notification with commenter details
router.post('/', auth, async (req, res) => {
  const { message, userId: recipientId, commenterId } = req.body; // Add commenterId

  try {
    // Fetch commenter details
    const commenter = await User.findById(commenterId).select('name');
    if (!commenter) throw new Error('Commenter not found');

    // Ensure recipientId is provided
    if (!recipientId) throw new Error('Recipient user ID is required');

    // Construct message with commenter's name if not provided
    const finalMessage = message || `${commenter.name || 'Unknown User'} commented on your post`;

    const notification = new Notification({
      user: recipientId, // The recipient of the notification
      message: finalMessage,
    });

    await notification.save();
    const populatedNotification = await Notification.findById(notification._id).populate('user', 'name');
    console.log('New notification created:', populatedNotification); // Debug
    res.status(201).json(populatedNotification);

    // Emit Socket.IO event
    const io = req.app.get('socketio');
    io.to(recipientId.toString()).emit('newNotification', populatedNotification);
  } catch (err) {
    console.error('Error creating notification:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
