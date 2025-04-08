const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Notification = require('../models/Notification');

// Get notifications for the logged-in user
router.get('/', auth, async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user.id })
      .populate('user', 'name') // Ensure user is populated
      .sort({ createdAt: -1 })
      .limit(5);
    console.log('Notifications fetched:', notifications); // Debug
    res.json(notifications);
  } catch (err) {
    console.error('Error fetching notifications:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create a new notification (e.g., triggered by likes or comments)
router.post('/', auth, async (req, res) => {
  const { message, userId } = req.body;

  try {
    const notification = new Notification({
      user: userId || req.user.id, // Use provided userId or current user
      message,
    });

    await notification.save();
    const populatedNotification = await Notification.findById(notification._id).populate('user', 'name');
    console.log('New notification created:', populatedNotification); // Debug
    res.status(201).json(populatedNotification);
  } catch (err) {
    console.error('Error creating notification:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;