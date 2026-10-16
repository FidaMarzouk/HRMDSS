process.env.TZ = 'Africa/Tunis';
require('dotenv').config();

const REQUIRED_ENV = ['MONGO_URI', 'JWT_SECRET'];
const missingEnv = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missingEnv.length > 0) {
  console.error(`Missing required environment variables: ${missingEnv.join(', ')}. See Backend/.env.example.`);
  process.exit(1);
}

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const multer = require('multer');
const cookieParser = require('cookie-parser');
const cron = require('node-cron');
const http = require('http');
const { updateAllUsersLeaveBalance } = require('./Middlewares/leaveCalculationHelper');
const { initializeSocket } = require('./Middlewares/notificationService');
const { markAbsentUsers } = require('./Controllers/attendanceController');
const knowledgeIndex = require('./services/rag/knowledgeIndex');
const { resumePendingNotifications } = require('./services/leaveDecisions');
const authRoutes = require('./Routes/authRoutes');
const userRoutes = require('./Routes/userRoutes');
const leaveRequestRoutes = require('./Routes/leaveRequestRoutes');
const notificationRoutes = require('./Routes/notificationRoutes');
const departmentRoutes = require('./Routes/departmentRoutes');
const attendanceRoutes = require('./Routes/attendanceRoutes');
const calendarRoutes = require('./Routes/calendarRoutes');
const chatbotRoutes = require('./Routes/chatbot.routes');
const chatRoutes = require('./Routes/ChatRoutes');
const hrDashRoutes = require('./Routes/hrDashboardRoutes');
const employeeDashRoutes = require('./Routes/employeeDashboardRoutes');
const managerDashRoutes = require('./Routes/managerDashboardRoutes');
const todayRoutes = require('./Routes/todayRoutes');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

const app = express();
const server = http.createServer(app);

initializeSocket(server, FRONTEND_URL);

// Profile pictures are loaded cross-origin by the frontend.
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: FRONTEND_URL,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use('/uploads', express.static('uploads'));

// Monthly leave balance refresh (1st of each month at 00:00)
cron.schedule('0 0 1 * *', async () => {
  await updateAllUsersLeaveBalance();
}, { timezone: 'Africa/Tunis' });

// Mark absences at 22:00 every weekday
cron.schedule('0 22 * * 1-5', async () => {
  try {
    const absentCount = await markAbsentUsers();
    console.log(`Marked ${absentCount} users as absent`);
  } catch (error) {
    console.error('Error in absent marking job:', error);
  }
}, { timezone: 'Africa/Tunis' });

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/leave-requests', leaveRequestRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/hr', hrDashRoutes);
app.use('/api/employee', employeeDashRoutes);
app.use('/api/manager', managerDashRoutes);
app.use('/api', todayRoutes); // /api/today, /api/presence, /api/me/counts, /api/search

// Unknown API routes
app.use('/api', (req, res) => {
  res.status(404).json({ message: 'Not found' });
});

// Central error handler (multer, body-parser and anything passed to next(err))
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large (max 2 MB).' : err.message;
    return res.status(400).json({ message });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Malformed JSON body.' });
  }
  const status = err.status || err.statusCode || 500;
  if (status >= 500) {
    console.error('Unhandled error:', err);
  }
  res.status(status).json({ message: status >= 500 ? 'Server error' : err.message });
});

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('Connected to MongoDB');
    // Leave decisions whose undo window ended while the server was down.
    const pending = await resumePendingNotifications();
    if (pending) console.log(`Resumed ${pending} pending leave decision notification(s)`);
  })
  .catch((err) => console.error('MongoDB connection error:', err));

// Build the assistant's knowledge index in the background; the server starts immediately.
knowledgeIndex.build().catch((err) => console.error('Knowledge index build failed:', err));

const PORT = process.env.PORT || 8081;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
