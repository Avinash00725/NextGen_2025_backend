const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const auth = require('../middleware/auth');
const Recipe = require('../models/Recipe');
const User = require('../models/User');
const Notification = require('../models/Notification');

// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/images/'); // Changed to 'uploads/images/' for consistency
  },
  filename: (req, file, cb) => {
    cb(null, `recipe-${Date.now()}${path.extname(file.originalname)}`);
  },
});
const upload = multer({ storage });

// Get all recipes (for Homepage)
router.get('/', async (req, res) => {
  try {
    const recipes = await Recipe.find().populate('createdBy', 'name');
    res.json(recipes);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's posted recipes (for User Dashboard)
router.get('/user', auth, async (req, res) => {
  try {
    const recipes = await Recipe.find({ createdBy: req.user.id }).populate('createdBy', 'name');
    res.json(recipes);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Create a new recipe (for Create Recipe page)
router.post('/', auth, upload.single('image'), async (req, res) => {
  const { title, prepTime } = req.body;
  const image = req.file ? `/uploads/images/${req.file.filename}` : '';

  try {
    const recipe = new Recipe({
      title,
      image,
      prepTime,
      createdBy: req.user.id,
    });

    await recipe.save();

    // Update user's postedRecipes count
    const user = await User.findById(req.user.id);
    user.postedRecipes += 1;
    user.rank = getUserRank(user.postedRecipes);
    await user.save();

    res.status(201).json(recipe);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete a recipe (for User Dashboard)
router.delete('/:id', auth, async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.id);
    if (!recipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }

    if (recipe.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await recipe.remove();

    // Update user's postedRecipes count
    const user = await User.findById(req.user.id);
    user.postedRecipes -= 1;
    user.rank = getUserRank(user.postedRecipes);
    await user.save();

    res.json({ message: 'Recipe deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Like a recipe
router.post('/:id/like', auth, async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.id).populate('createdBy', 'name');
    if (!recipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }

    const user = await User.findById(req.user.id);
    const userId = req.user.id;

    if (recipe.likes.includes(userId)) {
      // Unlike: Remove user from likes
      recipe.likes = recipe.likes.filter((id) => id.toString() !== userId);
    } else {
      // Like: Add user to likes
      recipe.likes.push(userId);
      // Create a notification for the recipe creator (if not the same user)
      if (recipe.createdBy._id.toString() !== userId) {
        const notification = new Notification({
          user: recipe.createdBy._id,
          message: `${user.name} liked your recipe: "${recipe.title}"`,
        });
        await notification.save();

        // Emit Socket.IO event for the notification
        const io = req.app.get('socketio');
        io.to(recipe.createdBy._id.toString()).emit('newNotification', notification);
      }
    }

    await recipe.save();
    const populatedRecipe = await Recipe.findById(recipe._id).populate('createdBy', 'name');

    // Emit Socket.IO event for recipe update
    const io = req.app.get('socketio');
    io.emit('recipeUpdated', populatedRecipe);

    res.json(populatedRecipe);
  } catch (err) {
    console.error('Error liking recipe:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Reshare a recipe
router.post('/:id/reshare', auth, async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.id).populate('createdBy', 'name');
    if (!recipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }

    const user = await User.findById(req.user.id);
    const userId = req.user.id;

    if (recipe.reshares.includes(userId)) {
      // Unshare: Remove user from reshares
      recipe.reshares = recipe.reshares.filter((id) => id.toString() !== userId);
    } else {
      // Reshare: Add user to reshares
      recipe.reshares.push(userId);
      // Create a notification for the recipe creator (if not the same user)
      if (recipe.createdBy._id.toString() !== userId) {
        const notification = new Notification({
          user: recipe.createdBy._id,
          message: `${user.name} reshared your recipe: "${recipe.title}"`,
        });
        await notification.save();

        // Emit Socket.IO event for the notification
        const io = req.app.get('socketio');
        io.to(recipe.createdBy._id.toString()).emit('newNotification', notification);
      }
    }

    await recipe.save();
    const populatedRecipe = await Recipe.findById(recipe._id).populate('createdBy', 'name');

    // Emit Socket.IO event for recipe update
    const io = req.app.get('socketio');
    io.emit('recipeUpdated', populatedRecipe);

    res.json(populatedRecipe);
  } catch (err) {
    console.error('Error resharing recipe:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Helper function to calculate user rank
const getUserRank = (postedRecipes) => {
  if (postedRecipes >= 16) return 'Legendary Chef';
  if (postedRecipes >= 11) return 'Master Chef';
  if (postedRecipes >= 6) return 'Professional Chef';
  if (postedRecipes >= 1) return 'Pro';
  return 'Beginner';
};

module.exports = router;