require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();
const expressLayouts = require('express-ejs-layouts');
const session = require('express-session');
const methodOverride = require('method-override');
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
const guardianLocationRoutes = require('./routes/guardianLocationRoutes');

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

app.use(methodOverride('_method'));

app.set('view engine', 'ejs');

app.set('views', path.join(__dirname, 'views'));
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
app.use('/api/location', locationRoutes);
app.use('/api/guardian-location', guardianLocationRoutes);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/', (req, res) => {
    res.redirect('/admin/login');
});

// Export both app and server
module.exports = { app, server };
