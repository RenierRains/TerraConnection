require('dotenv').config(); // Loads environment variables from .env
const express = require('express');
const cors = require('cors');
const db = require('./models'); // loads index.js, which initializes all models
const authRoutes = require('./routes/auth');
const rfidRoutes = require('./routes/rfid');
const gpsRoutes = require('./routes/gps');
const professorRoutes = require('./routes/professor');
const guardianRoutes = require('./routes/guardian');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Simple health-check route
app.get('/', (req, res) => {
  res.json({ message: 'RFID Attendance System is running.' });
});

// Register your feature-specific routes
app.use('/api/auth', authRoutes);
app.use('/api/rfid', rfidRoutes);
app.use('/api/gps', gpsRoutes);
app.use('/api/professor', professorRoutes);
app.use('/api/guardian', guardianRoutes);

module.exports = app;