require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();

// Import route files
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const rfidRoutes = require('./routes/rfid');
const gpsRoutes = require('./routes/gps');
const studentRoutes = require('./routes/student');
const professorRoutes = require('./routes/professor');
const guardianRoutes = require('./routes/guardian');

app.use(cors());
app.use(express.json());

// Mount routes with base paths
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/rfid', rfidRoutes);
app.use('/api/gps', gpsRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/professor', professorRoutes);
app.use('/api/guardian', guardianRoutes);

module.exports = app;