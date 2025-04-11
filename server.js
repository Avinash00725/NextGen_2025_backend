const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs'); // Added for directory check

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'development' 
      ? 'http://localhost:3000' 
      : 'https://nextgen-2025-backend.onrender.com', // Dynamic CORS based on environment
    methods: ['GET', 'POST'],
    credentials: true, // Allow cookies/auth if needed
  },
});

// Middleware
app.use(cors()); // Global CORS (can be restricted per route if needed)
app.use(express.json());

// Serve static files (consolidate and ensure directories exist)
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Created uploads directory:', uploadsDir);
}
const imagesDir = path.join(uploadsDir, 'images');
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
  console.log('Created uploads/images directory:', imagesDir);
}
const videosDir = path.join(uploadsDir, 'videos');
if (!fs.existsSync(videosDir)) {
  fs.mkdirSync(videosDir, { recursive: true });
  console.log('Created uploads/videos directory:', videosDir);
}

app.use('/uploads', express.static(uploadsDir)); // Base uploads directory
app.use('/uploads/images', express.static(imagesDir)); // Specific for images
app.use('/uploads/videos', express.static(videosDir)); // Specific for videos

// Routes
const userRoutes = require('./routes/users');
const recipeRoutes = require('./routes/recipes');
const postRoutes = require('./routes/posts');
const notificationRoutes = require('./routes/notifications');

app.use('/api/users', userRoutes);
app.use('/api/recipes', recipeRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/notifications', notificationRoutes);

// Socket.IO
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Make io accessible to routes
app.set('socketio', io);

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Start the server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
