require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();
const expressLayouts = require('express-ejs-layouts');
const session = require('express-session');
const methodOverride = require('method-override');
const auditMiddleware = require('./middleware/auditMiddleware');

const adminWebRoutes = require('./routes/adminWeb');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const scanRoutes = require('./routes/gates');
const rfidRoutes = require('./routes/rfid');
const gpsRoutes = require('./routes/gps');
const studentRoutes = require('./routes/student');
const professorRoutes = require('./routes/professor');
const guardianRoutes = require('./routes/guardian');
const userRoutes = require('./routes/user');


app.enable('trust proxy');  
app.set('trust proxy', function(ip) {
    console.log('Evaluating proxy trust for IP:', ip); //test
    return true; 
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(methodOverride('_method'));

app.set('view engine', 'ejs');

app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

app.use(auditMiddleware);

app.use(expressLayouts);
app.set('layout', 'layout');

app.use(session({
  secret: 'JkdsJGJdsfuJasdM3893024p@**($&%',
  resave: false,
  saveUninitialized: false
}));

// use mount
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/admin', adminWebRoutes);
app.use('/api/rfid', rfidRoutes);
app.use('/scangate', scanRoutes);
app.use('/api/gps', gpsRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/professor', professorRoutes);
app.use('/api/guardian', guardianRoutes);
app.use('/api/user', userRoutes);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/', (req, res) => {
  res.redirect('/admin/login');
});

module.exports = app;
