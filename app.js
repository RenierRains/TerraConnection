require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();
const expressLayouts = require('express-ejs-layouts');
const session = require('express-session');

const adminWebRoutes = require('./routes/adminWeb');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const rfidRoutes = require('./routes/rfid');
const gpsRoutes = require('./routes/gps');
const studentRoutes = require('./routes/student');
const professorRoutes = require('./routes/professor');
const guardianRoutes = require('./routes/guardian');

app.use(cors());
app.use(express.json());

// use mount
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/admin', adminWebRoutes);
app.use('/api/rfid', rfidRoutes);
app.use('/api/gps', gpsRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/professor', professorRoutes);
app.use('/api/guardian', guardianRoutes);

app.set('view engine', 'ejs');

app.set('views', path.join(__dirname, 'views'));

app.use(expressLayouts);

app.use(session({
  secret: 'yourSecretKey',
  resave: false,
  saveUninitialized: false
}));



module.exports = app;