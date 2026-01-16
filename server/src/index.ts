import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

// BigInt JSON Serialization Support
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

// Routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import employeeRoutes from './routes/employees.js';
import dashboardRoutes from './routes/dashboard.js';
import adminRoutes from './routes/admin.js';
import absenceRoutes from './routes/absences.js';
import taskRoutes from './routes/tasks.js';
import sanctionRoutes from './routes/sanctions.js';
import treasuryRoutes from './routes/treasury.js';
import noteRoutes from './routes/notes.js';
import announcementRoutes from './routes/announcements.js';
import evidenceRoutes from './routes/evidence.js';
import tuningRoutes from './routes/tuning.js';
import robberyRoutes from './routes/robbery.js';
import blacklistRoutes from './routes/blacklist.js';
import uprankLockRoutes from './routes/uprankLock.js';
import applicationRoutes from './routes/applications.js';
import caseRoutes from './routes/cases.js';
import trainingRoutes from './routes/trainings.js';
import investigationRoutes from './routes/investigations.js';
import unitReviewRoutes from './routes/unitReviews.js';
import uprankRequestRoutes from './routes/uprankRequests.js';
import teamChangeReportRoutes from './routes/teamChangeReports.js';
import academyRoutes from './routes/academy.js';
import bonusRoutes from './routes/bonus.js';
import archiveRoutes from './routes/archive.js';
import notificationRoutes from './routes/notifications.js';
import discordAnnouncementRoutes from './routes/discordAnnouncements.js';
import unitRoutes from './routes/units.js';

// Services
import { initializeDiscordBot } from './services/discordBot.js';
import { initializeSocket } from './services/socketService.js';
import { auditMiddleware } from './middleware/auditMiddleware.js';
import { initializeBonusCronJob } from './services/bonusService.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
// Erlaubte Origins für CORS
const allowedOrigins = [
  'http://localhost:5173',
  'http://192.168.2.103:5173',
  'http://test.mas0n1x.online',
  'https://test.mas0n1x.online',
];

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});

export const prisma = new PrismaClient();

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Erlaube Requests ohne Origin (z.B. von curl oder Postman)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('CORS nicht erlaubt'), false);
  },
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());
app.use(auditMiddleware);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/absences', absenceRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/sanctions', sanctionRoutes);
app.use('/api/treasury', treasuryRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/evidence', evidenceRoutes);
app.use('/api/tuning', tuningRoutes);
app.use('/api/robbery', robberyRoutes);
app.use('/api/blacklist', blacklistRoutes);
app.use('/api/uprank-locks', uprankLockRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/cases', caseRoutes);
app.use('/api/trainings', trainingRoutes);
app.use('/api/investigations', investigationRoutes);
app.use('/api/unit-reviews', unitReviewRoutes);
app.use('/api/uprank-requests', uprankRequestRoutes);
app.use('/api/team-change-reports', teamChangeReportRoutes);
app.use('/api/academy', academyRoutes);
app.use('/api/bonus', bonusRoutes);
app.use('/api/archive', archiveRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/discord-announcements', discordAnnouncementRoutes);
app.use('/api/units', unitRoutes);

// Error handling
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Initialize services
const PORT = process.env.PORT || 3001;

async function startServer() {
  try {
    // Connect to database
    await prisma.$connect();
    console.log('✅ Database connected');

    // Initialize Socket.io
    initializeSocket(io);
    console.log('✅ Socket.io initialized');

    // Initialize Discord Bot (optional, can fail gracefully)
    if (process.env.DISCORD_BOT_TOKEN) {
      try {
        await initializeDiscordBot();
        console.log('✅ Discord Bot initialized');
      } catch (error) {
        console.warn('⚠️ Discord Bot failed to initialize:', error);
      }
    } else {
      console.log('ℹ️ Discord Bot not configured (DISCORD_BOT_TOKEN missing)');
    }

    // Initialize Bonus Cron Job (weekly reset on Sunday 23:59)
    initializeBonusCronJob();
    console.log('✅ Bonus Cron Job initialized');

    httpServer.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down...');
  await prisma.$disconnect();
  process.exit(0);
});

startServer();

export { io };
