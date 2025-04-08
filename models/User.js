const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  avatar: { type: String, default: '' },
  postedRecipes: { type: Number, default: 0 },
  likedRecipes: { type: Number, default: 0 },
  rank: { type: String, default: 'Beginner' },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('User', userSchema);