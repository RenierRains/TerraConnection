require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();
const expressLayouts = require('express-ejs-layouts');
const session = require('express-session');
const methodOverride = require('method-override');
const multer = require('multer');
const auditMiddleware = require('./middleware/auditMiddleware');
const modalHandler = require('./middleware/modalHandler');
const http = require('http');
const socketIo = require('socket.io');
const WebSocket = require('ws');
const { authenticateToken } = require('./middleware/auth');
const locationController = require('./controllers/locationController');

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
const locationRoutes = require('./routes/locationRoutes');
const visitorKioskRoutes = require('./routes/visitorKiosk');
const visitorAdminRoutes = require('./routes/visitorAdmin');
const kioskRoutes = require('./routes/kiosk');
const { apiRateLimiter, adminWebRateLimiter } = require('./middleware/rateLimiters');

// Create HTTP server
const server = http.createServer(app);

// Create Socket.IO server
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Create WebSocket server
const wss = new WebSocket.Server({ noServer: true });

// Store io instance in app for use in routes
app.set('io', io);
app.set('wss', wss);

// WebSocket upgrade handling
server.on('upgrade', function upgrade(request, socket, head) {
    const pathname = new URL(request.url, 'ws://terraconnection.online').pathname;
    
    if (pathname === '/ws') {
        // Extract token from Authorization header
        const token = request.headers.authorization?.split(' ')[1];
        if (!token) {
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
            socket.destroy();
            return;
        }

        try {
            // Verify token
            const decoded = require('jsonwebtoken').verify(token, process.env.JWT_SECRET);
            request.user = decoded;
            wss.handleUpgrade(request, socket, head, function done(ws) {
                wss.emit('connection', ws, request);
            });
        } catch (err) {
            socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
            socket.destroy();
        }
    } else {
        socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
        socket.destroy();
    }
});

// Raw WebSocket connection handling
wss.on('connection', function connection(ws, request) {
    console.log('Raw WebSocket client connected');
    
    ws.on('message', async function incoming(message) {
        try {
            const data = JSON.parse(message);
            if (data.type === 'join-class' && data.classId) {
                ws.classId = data.classId;
                console.log(`Client joined class ${data.classId}`);
                
                // Send initial active users count when joining
                const count = await locationController.getActiveUsersCount(data.classId);
                const response = {
                    type: 'activeUsers',
                    classId: data.classId.toString(),
                    count: count
                };
                ws.send(JSON.stringify(response));
                console.log('Sent initial active users count:', response);
            } else if (data.type === 'get-active-users' && data.classId) {
                const count = await locationController.getActiveUsersCount(data.classId);
                const response = {
                    type: 'activeUsers',
                    classId: data.classId.toString(),
                    count: count
                };
                ws.send(JSON.stringify(response));
                console.log('Sent active users response:', response);
            } else if (data.type === 'ping') {
                ws.send(JSON.stringify({ type: 'pong' }));
            }
        } catch (e) {
            console.error('Error handling WebSocket message:', e);
        }
    });
    
    ws.on('close', () => {
        console.log('Raw WebSocket client disconnected');
    });
});

// Initialize Dashboard WebSocket Service
const DashboardWebSocketService = require('./services/dashboardWebSocket');
const dashboardWS = new DashboardWebSocketService(io);
dashboardWS.init();

// Store dashboard service in app for use in routes
app.set('dashboardWS', dashboardWS);

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('Socket.IO client connected');
    
    socket.on('join-class', (classId) => {
        socket.join(`class-${classId}`);
    });
    
    socket.on('leave-class', (classId) => {
        socket.leave(`class-${classId}`);
    });
    
    socket.on('disconnect', () => {
        console.log('Socket.IO client disconnected');
    });
});

app.enable('trust proxy');  
app.set('trust proxy', function(ip) {
    console.log('Evaluating proxy trust for IP:', ip);
    return true; 
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configure method-override to work with multipart forms
app.use(methodOverride(function (req, res) {
  if (req.body && typeof req.body === 'object' && '_method' in req.body) {
    // look in urlencoded POST bodies and delete it
    var method = req.body._method;
    delete req.body._method;
    return method;
  }
  // look in query parameters
  if (req.query && req.query._method) {
    return req.query._method;
  }
}));

app.set('view engine', 'ejs');

app.set('views', path.join(__dirname, 'views'));

// Serve ML models with long-term caching for performance (must come BEFORE generic static)
app.use('/models', express.static(path.join(__dirname, 'public', 'models'), {
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }
}));

// Generic static after models so headers above apply
app.use(express.static(path.join(__dirname, 'public')));

app.use(auditMiddleware);

app.use(modalHandler);
app.use(expressLayouts);
app.set('layout', 'layout');

app.use(session({
    secret: 'JkdsJGJdsfuJasdM3893024p@**($&%',
    resave: false,
    saveUninitialized: false
}));

app.use((req, res, next) => {
  res.locals.admin = req.session?.admin || null;
  res.locals.toasts = Array.isArray(req.session?.toasts) ? req.session.toasts : [];
  if (req.session) {
    req.session.toasts = [];
  }
  next();
});

// use mount
app.use('/api/auth', apiRateLimiter, authRoutes);
app.use('/api/admin', apiRateLimiter, adminRoutes);
app.use('/api/rfid', apiRateLimiter, rfidRoutes);
app.use('/scangate', scanRoutes);
app.use('/api/gps', apiRateLimiter, gpsRoutes);
app.use('/api/student', apiRateLimiter, studentRoutes);
app.use('/api/professor', apiRateLimiter, professorRoutes);
app.use('/api/guardian', apiRateLimiter, guardianRoutes);
app.use('/api/user', apiRateLimiter, userRoutes);
app.use('/api/location', apiRateLimiter, locationRoutes);
app.use('/api/kiosk/visitor', apiRateLimiter, visitorKioskRoutes);
app.use('/admin/visitors', adminWebRateLimiter, visitorAdminRoutes);
app.use('/admin', adminWebRateLimiter, adminWebRoutes);
app.use('/kiosk', kioskRoutes);
// Serve uploads directory with proper headers
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res, path) => {
    // Set proper headers for images
    if (path.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
      res.setHeader('Content-Type', 'image/' + path.split('.').pop().toLowerCase());
      res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year cache
    }
  }
}));

console.log('📁 Uploads directory served at /uploads -> ', path.join(__dirname, 'uploads'));

app.get('/', (req, res) => {
    res.redirect('/admin/login');
});

// Test route for profile pictures
app.get('/test-profile-pics', async (req, res) => {
    try {
        const db = require('./models');
        const users = await db.User.findAll({
            where: {
                profile_picture: {
                    [db.Sequelize.Op.ne]: null
                }
            },
            attributes: ['id', 'first_name', 'last_name', 'profile_picture'],
            limit: 10
        });

        let html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Test Profile Pictures</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    .user { margin: 20px 0; padding: 10px; border: 1px solid #ccc; }
                    img { max-width: 200px; margin: 10px; }
                    .error { color: red; }
                    .success { color: green; }
                </style>
            </head>
            <body>
                <h1>Profile Picture Test</h1>
                <h2>Users with Profile Pictures:</h2>
        `;

        users.forEach(user => {
            let profileUrl = user.profile_picture;
            if (profileUrl && !profileUrl.startsWith('/') && !profileUrl.startsWith('http') && !profileUrl.startsWith('uploads/')) {
                profileUrl = `uploads/profile_pics/${profileUrl}`;
            }
            
            html += `
                <div class="user">
                    <h3>${user.first_name} ${user.last_name} (ID: ${user.id})</h3>
                    <p>DB Value: <code>${user.profile_picture}</code></p>
                    <p>Formatted URL: <code>${profileUrl}</code></p>
                    <img src="${profileUrl}" alt="${user.first_name}'s photo" 
                         onload="this.nextSibling.innerHTML='✅ Image loaded successfully'" 
                         onerror="this.nextSibling.innerHTML='❌ Image failed to load'">
                    <span class="status"></span>
                </div>
            `;
        });

        html += `
                <h2>Direct File Test:</h2>
                <p>Testing direct access to uploaded files:</p>
                <img src="/uploads/profile_pics/2-1754027682570.jpg" alt="Direct test" style="border: 2px solid blue;">
                <img src="/uploads/profile_pics/2-1754026101183.jpg" alt="Direct test" style="border: 2px solid blue;">
                <img src="/uploads/profile_pics/1-1754026059152.png" alt="Direct test" style="border: 2px solid blue;">
            </body>
            </html>
        `;
        
        res.send(html);
    } catch (error) {
        res.status(500).send(`Error: ${error.message}`);
    }
});

// Export both app and server
module.exports = { app, server };
