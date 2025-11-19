import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import passport from 'passport';
import session from 'express-session';
import { Strategy as GoogleStrategy, Profile } from 'passport-google-oauth20';
import { Strategy as LocalStrategy } from 'passport-local';
import bcrypt from 'bcrypt';
import { User } from '@prisma/client';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { geminiModelRotation } from './gemini-model-rotation';
import crypto from 'crypto';
import { prisma, prismaAny } from './prisma-client.js';

// RAG imports
import documentRoutes from './routes/document.routes.js';
import chatRoutes from './routes/chat.routes.js';
import collectionRoutes from './routes/collection.routes.js';
import ragConfigRoutes from './routes/rag-config.routes.js';
import { pdfProcessorService } from './services/pdf-processor.service.js';
import { qdrantService } from './services/qdrant.service.js';
import { modelSettingsService } from './services/model-settings.service.js';

// Export prisma for backward compatibility
export { prisma };


// Initialize model settings service
modelSettingsService.initialize(prisma);

const app = express();
const httpServer = createServer(app);

// Setup Socket.IO with CORS
const io = new SocketIOServer(httpServer, {
  path: '/socket.io',  // Explicit path
  cors: {
    origin: (origin, callback) => {
      // Allow all origins in development, specific in production
      const allowedOrigins = [
        'http://localhost:5173',
        'http://localhost:3000',
        'http://13.229.10.40',
        'http://13.229.10.40:3000',
        'https://13.229.10.40',
        'https://giadinhnhimsoc.site',
        'https://www.giadinhnhimsoc.site',
        'http://giadinhnhimsoc.site',
        'http://www.giadinhnhimsoc.site',
        process.env.FRONTEND_URL || '',
      ].filter(Boolean);

      // In development, allow any origin
      if (!origin || allowedOrigins.length === 0 || process.env.NODE_ENV !== 'production') {
        console.log('[Socket.IO CORS] Allowing origin (dev mode):', origin);
        callback(null, true);
      } else if (allowedOrigins.some(allowed => origin.includes(allowed) || allowed === origin)) {
        console.log('[Socket.IO CORS] Allowing origin:', origin);
        callback(null, true);
      } else {
        // In production, also allow same-origin requests
        console.log('[Socket.IO CORS] Allowing origin (same-origin):', origin);
        callback(null, true);
      }
    },
    credentials: true,
    methods: ['GET', 'POST']
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['polling', 'websocket'],  // Try polling first, then upgrade to websocket
  allowEIO3: true,  // Allow compatibility with older clients
  connectTimeout: 45000,
  upgradeTimeout: 30000
});

// Socket.IO connection handler
io.on('connection', (socket) => {
  console.log('[Socket.IO] Client connected:', socket.id);
  console.log('[Socket.IO] Transport:', socket.conn.transport.name);
  console.log('[Socket.IO] Address:', socket.handshake.address);
  console.log('[Socket.IO] Headers:', socket.handshake.headers.origin);

  // Store userId when client authenticates
  socket.on('authenticate', (userId: string) => {
    socket.data.userId = userId;
    socket.join(`user:${userId}`); // Join room specific to this user
    console.log('[Socket.IO] User authenticated:', userId, 'rooms:', Array.from(socket.rooms));
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket.IO] Client disconnected:', socket.id, 'reason:', reason);
  });

  socket.on('error', (error) => {
    console.error('[Socket.IO] Socket error:', socket.id, error);
  });
});

// Initialize RAG services (PDF processor needs Socket.IO for progress updates)
pdfProcessorService.setSocketIO(io);

// Log Socket.IO errors
io.engine.on('connection_error', (err) => {
  console.error('[Socket.IO Engine] Connection error:', {
    message: err.message,
    code: (err as any).code,
    context: (err as any).context
  });
});

// Device Management Helpers
function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

async function handleDeviceLogin(userId: string, deviceId: string): Promise<{ sessionToken: string; needsLogout: boolean }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { currentDeviceId: true, currentSessionToken: true }
  }) as any;

  if (!user) {
    throw new Error('User not found');
  }

  const sessionToken = generateSessionToken();
  const needsLogout = !!(user.currentDeviceId && user.currentDeviceId !== deviceId);

  // If user is logged in on a different device, notify that device to logout
  if (needsLogout) {
    console.log(`[Device] User ${userId} logging in from new device. Logging out device: ${user.currentDeviceId}`);

    // Emit logout event to the old device via Socket.IO
    io.to(`user:${userId}`).emit('force-logout', {
      reason: 'new-device-login',
      message: 'Bạn đã đăng nhập từ thiết bị khác'
    });
  }

  // Update user with new device and session token
  await prisma.user.update({
    where: { id: userId },
    data: {
      currentDeviceId: deviceId,
      currentSessionToken: sessionToken
    } as any
  });

  console.log(`[Device] User ${userId} logged in from device: ${deviceId}`);

  return { sessionToken, needsLogout };
}

async function validateDeviceSession(userId: string, deviceId: string, sessionToken: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { currentDeviceId: true, currentSessionToken: true }
  }) as any;

  if (!user) {
    return false;
  }

  // Check if device and session match
  return user.currentDeviceId === deviceId && user.currentSessionToken === sessionToken;
}

const bodyLimit = process.env.MAX_BODY_SIZE || '5mb';

// Allow multiple origins (localhost + production domains/IP) configurable via env
const allowedOrigins = (process.env.ALLOWED_ORIGINS || [
  'http://localhost',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://13.229.10.40',
  'http://13.229.10.40:3000',
  'https://13.229.10.40',
  'https://giadinhnhimsoc.site',
  'https://www.giadinhnhimsoc.site',
  'http://giadinhnhimsoc.site',
  'http://www.giadinhnhimsoc.site'
].join(',')).split(',').map(o => o.trim()).filter(Boolean);

app.use(cors({
  origin: true, // allow all origins
  credentials: true
}));
app.set('trust proxy', 1); // behind reverse proxy (needed for secure cookies)
app.use(express.json({ limit: bodyLimit }));
app.use(express.urlencoded({ extended: true, limit: bodyLimit }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: 'auto', // auto secure if request is https
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days (1 month) in milliseconds
  }
}));
app.use(passport.initialize());
app.use(passport.session());

// Add LocalStrategy for username/password
passport.use(new LocalStrategy(
  async (username, password, done) => {
    try {
      const user = await prisma.user.findUnique({ where: { username } });
      if (!user) {
        return done(null, false, { message: 'Incorrect username.' });
      }
      if (!user.password) {
        return done(null, false, { message: 'Password not set for this user.' });
      }
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return done(null, false, { message: 'Incorrect password.' });
      }
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }
));

passport.serializeUser((user: any, done: (err: any, id?: any) => void) => done(null, user.id));
passport.deserializeUser(async (id: string, done: (err: any, user?: any) => void) => {
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    done(null, user);
  } catch (e) {
    done(e);
  }
});

// --- Unified configuration (no production branching) ---
// Use single set of env vars; fall back to localhost defaults.
const appBaseUrl = (process.env.APP_BASE_URL || 'http://localhost:5173').replace(/\/$/, '');
const backendBaseUrl = (process.env.BACKEND_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const clientID = (process.env.GOOGLE_CLIENT_ID || '').trim();
const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || '').trim();
const callbackURL = (process.env.GOOGLE_CALLBACK_URL || `${backendBaseUrl}/api/auth/google/callback`).replace(/\/$/, '');

if (!clientID || !clientSecret) {
  console.error('[Config] Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in .env');
}
console.log('[Config] APP_BASE_URL =', appBaseUrl);
console.log('[Config] BACKEND_BASE_URL =', backendBaseUrl);
console.log('[OAuth] Client ID prefix =', clientID ? clientID.slice(0, 8) + '...' : 'MISSING');
console.log('[OAuth] Callback URL =', callbackURL);

passport.use(new GoogleStrategy(
  {
    clientID: clientID,
    clientSecret: clientSecret,
    callbackURL // will be overridden per-request for proper domain
  },
  async (_accessToken: string, _refreshToken: string, profile: Profile, done: (err: any, user?: User) => void) => {
    try {
      const email = profile.emails?.[0]?.value;
      if (!email) return done(new Error('No email from Google'));
      let user = await prisma.user.findUnique({ where: { email } });
      const emailLocal = email.split('@')[0];
      if (!user) {
        // Try to link to an existing username-only account (e.g. admin created without email)
        const candidate = await prisma.user.findFirst({ where: { username: emailLocal, email: null } as any });
        if (candidate) {
          user = await prisma.user.update({
            where: { id: candidate.id },
            data: {
              email,
              name: candidate.name || profile.displayName,
              picture: profile.photos?.[0]?.value || candidate.picture
            }
          });
          console.log('[OAuth] Linked Google account to existing user (by username match):', user.id, 'role=', (user as any).role);
        } else {
          user = await prisma.user.create({ data: { email, name: profile.displayName, picture: profile.photos?.[0]?.value } });
          console.log('[OAuth] Created new user from Google:', user.id, 'role=', (user as any).role);
        }
      } else {
        console.log('[OAuth] Found existing user by email:', user.id, 'role=', (user as any).role);
      }
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }
));

app.get('/api/healthcheck', (req, res) => {
  return res.json({ status: 'ok' });
});

// Mount RAG document routes (admin only)
app.use('/api/documents', documentRoutes);

// Mount chat routes (authenticated users)
app.use('/api/chat', chatRoutes);

// Mount collection management routes (admin only)
app.use('/api/admin', collectionRoutes);

// Mount RAG configuration routes (admin only)
app.use('/api/rag-config', ragConfigRoutes);


// OAuth routes (canonical path /api/auth/...)
app.get('/api/auth/google', (req, res, next) => {
  // Build dynamic callback only if no explicit GOOGLE_CALLBACK_URL provided.
  let dynamicCallback = callbackURL;
  if (!process.env.GOOGLE_CALLBACK_URL) {
    const host = (req.headers['x-forwarded-host'] as string) || req.headers.host;
    if (host) {
      const proto = (req.headers['x-forwarded-proto'] as string) || (req.secure ? 'https' : 'http');
      dynamicCallback = `${proto}://${host.replace(/\/$/, '')}/api/auth/google/callback`;
    }
  }
  console.log('[OAuth] Start flow callback=', dynamicCallback);
  return passport.authenticate('google', { scope: ['profile', 'email'], callbackURL: dynamicCallback } as any)(req, res, next);
});
app.get('/api/auth/google/callback', passport.authenticate('google', { failureRedirect: '/api/auth/fail' }), async (req: Request, res: Response) => {
  // If APP_BASE_URL provided, always trust it. Otherwise derive from forwarded headers (production behind Nginx)
  let finalBase = appBaseUrl;
  if (!process.env.APP_BASE_URL) {
    const host = (req.headers['x-forwarded-host'] as string) || req.headers.host;
    if (host) {
      const proto = (req.headers['x-forwarded-proto'] as string) || (req.secure ? 'https' : 'http');
      finalBase = `${proto}://${host.replace(/\/$/, '')}`;
    }
  }

  // Handle device tracking for OAuth login
  try {
    const user = req.user as any;
    const deviceId = req.query.deviceId as string || `google-${Date.now()}`;

    // Generate session token and handle device logout
    const { sessionToken } = await handleDeviceLogin(user.id, deviceId);

    // Store sessionToken in session for later retrieval
    (req.session as any).deviceSessionToken = sessionToken;
    (req.session as any).deviceId = deviceId;
  } catch (error) {
    console.error('Device tracking error during OAuth:', error);
  }

  res.redirect(finalBase + '/');
});

app.post('/api/auth/register', async (req: Request, res: Response) => {
  const { username, password, name } = req.body;
  if (!username || !password || !name) {
    return res.status(400).json({ error: 'Username, password, and name are required.' });
  }

  try {
    const existingUser = await prisma.user.findUnique({ where: { username } });
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        name,
      }
    });
    res.json({ id: user.id, username: user.username, name: user.name });
  } catch (error) {
    console.error('Registration failed:', error);
    res.status(500).json({ error: 'Registration failed.' });
  }
});

app.post('/api/auth/login', passport.authenticate('local'), async (req: Request, res: Response) => {
  // If this function gets called, authentication was successful.
  // `req.user` contains the authenticated user.
  try {
    const user = req.user as any;
    const deviceId = req.body.deviceId || req.headers['x-device-id'] as string;

    if (!deviceId) {
      return res.status(400).json({ error: 'Device ID is required' });
    }

    // Handle device login (will logout other devices if needed)
    const { sessionToken, needsLogout } = await handleDeviceLogin(user.id, deviceId);

    res.json({
      user: req.user,
      sessionToken,
      deviceId,
      wasLoggedOutFromOtherDevice: needsLogout
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/auth/logout', async (req: Request, res: Response) => {
  try {
    const user = req.user as any;

    // Clear device session from database if user is logged in
    if (user?.id) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          currentDeviceId: null,
          currentSessionToken: null
        } as any
      });
    }

    req.logout(err => {
      if (err) console.error(err);
      req.session.destroy(() => {
        res.clearCookie('connect.sid');
        res.json({ ok: true });
      });
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Device session validation endpoint
app.post('/api/auth/validate-device', async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user) {
      return res.status(401).json({ valid: false, error: 'Not authenticated' });
    }

    const { deviceId, sessionToken } = req.body;
    if (!deviceId || !sessionToken) {
      return res.status(400).json({ valid: false, error: 'Missing deviceId or sessionToken' });
    }

    const isValid = await validateDeviceSession(user.id, deviceId, sessionToken);

    if (!isValid) {
      return res.status(401).json({
        valid: false,
        error: 'invalid-session',
        message: 'Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.'
      });
    }

    res.json({ valid: true });
  } catch (error) {
    console.error('Device validation error:', error);
    res.status(500).json({ valid: false, error: 'Validation failed' });
  }
});

// Helper function to get active subscription
async function getActiveSubscription(userId: string) {
  const now = new Date();
  return await prismaAny.subscription.findFirst({
    where: {
      userId: userId,
      status: 'active',
      expiresAt: {
        gt: now
      }
    },
    orderBy: {
      expiresAt: 'desc' // Get the one that expires latest
    }
  });
}

app.get('/api/auth/me', async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ user: null });

  try {
    const userId = (req.user as any).id;
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        branchCode: true,
        picture: true,
        role: true,
        aiSearchQuota: true,
        quickSearchQuota: true
      }
    });

    if (!dbUser) {
      return res.status(404).json({ user: null });
    }

    // Get active subscription
    const activeSubscription = await getActiveSubscription(userId);

    // Get device session info from session
    const sessionToken = (req.session as any)?.deviceSessionToken;
    const deviceId = (req.session as any)?.deviceId;

    // Build response with premium info from subscription
    // Admin users automatically get premium benefits
    const userWithPremium = {
      ...dbUser,
      isPremium: dbUser.role === 'admin' || !!activeSubscription,
      premiumPlan: dbUser.role === 'admin' ? 'premium' : (activeSubscription?.plan || null),
      premiumExpiresAt: dbUser.role === 'admin' ? null : (activeSubscription?.expiresAt || null),
      hasQuickSearchAccess: dbUser.role === 'admin' || !!activeSubscription, // Admin and premium users have quick search access
      quickSearchQuota: dbUser.quickSearchQuota,
      sessionToken,
      deviceId
    };

    res.json({ user: userWithPremium });
  } catch (error) {
    console.error('Error fetching user data:', error);
    res.json({ user: req.user });
  }
});

app.put('/api/user/details', async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { name, branchCode } = req.body;
  const userId = (req.user as any).id;

  const allowedBranchCodes = ["2300", "2301", "2302", "2305", "2306", "2308", "2309", "2310", "2312", "2313"];
  if (branchCode && !allowedBranchCodes.includes(branchCode)) {
    return res.status(400).json({ error: 'Invalid branch code.' });
  }

  try {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        name: name || undefined,
        branchCode: branchCode || undefined,
      }
    });
    res.json({ user: updatedUser });
  } catch (error) {
    console.error('Failed to update user details:', error);
    res.status(500).json({ error: 'Failed to update user details.' });
  }
});

// Knowledge Bases CRUD (simplified aggregate endpoints)
app.get('/api/bases', async (_req: Request, res: Response) => {
  try {
    const bases = await prisma.knowledgeBase.findMany({
      include: { questions: true },
      orderBy: { createdAt: 'desc' }
    });
    const result = bases.map(b => ({
      id: b.id,
      name: b.name,
      createdAt: b.createdAt,
      questions: b.questions.map(q => ({
        id: q.id,
        question: q.text,
        options: JSON.parse(q.options),
        correctAnswerIndex: q.correctAnswerIdx,
        source: q.source || '',
        category: q.category || ''
      }))
    }));
    res.json(result);
  } catch (e) {
    console.error('Failed to load knowledge bases', e);
    res.status(500).json({ error: 'Failed to load knowledge bases' });
  }
});

app.post('/api/bases', async (req: Request, res: Response) => {
  const { email, base } = req.body;
  if (!email || !base) return res.status(400).json({ error: 'Invalid' });
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) user = await prisma.user.create({ data: { email } });
  if ((user as any).role !== 'admin') return res.status(403).json({ error: 'Only admin can create knowledge bases' });
  const created = await prisma.knowledgeBase.create({
    data: {
      name: base.name,
      userId: user.id,
      questions: {
        create: base.questions.map((q: any) => ({ text: q.question, options: JSON.stringify(q.options), correctAnswerIdx: q.correctAnswerIndex, source: q.source, category: q.category }))
      }
    },
    include: { questions: true }
  });
  res.json({
    id: created.id,
    name: created.name,
    createdAt: created.createdAt,
    questions: created.questions.map(q => ({
      id: q.id,
      question: q.text,
      options: JSON.parse(q.options),
      correctAnswerIndex: q.correctAnswerIdx,
      source: q.source || '',
      category: q.category || ''
    }))
  });
});

app.delete('/api/bases/:id', async (req: Request, res: Response) => {
  const id = req.params.id;
  await prisma.knowledgeBase.delete({ where: { id } });
  res.json({ ok: true });
});

// Quick Search - Get questions from multiple knowledge bases
app.post('/api/quick-search/questions', async (req: Request, res: Response) => {
  try {
    const { knowledgeBaseIds, userEmail } = req.body;

    if (!knowledgeBaseIds || !Array.isArray(knowledgeBaseIds) || knowledgeBaseIds.length === 0) {
      return res.status(400).json({ error: 'Invalid knowledge base IDs' });
    }

    if (!userEmail) {
      return res.status(400).json({ error: 'User email is required' });
    }

    // Check if user has access to quick search feature
    // Try to find user by email first, then by username
    let user = await prisma.user.findUnique({
      where: { email: userEmail },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        quickSearchQuota: true
      }
    });

    if (!user) {
      user = await prisma.user.findUnique({
        where: { username: userEmail },
        select: {
          id: true,
          email: true,
          username: true,
          role: true,
          quickSearchQuota: true
        }
      });
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get active subscription
    const activeSubscriptions = await prisma.subscription.findMany({
      where: {
        userId: user.id,
        status: 'active',
        expiresAt: {
          gt: new Date()
        }
      }
    });

    const hasActiveSubscription = activeSubscriptions.length > 0;

    // Check if user is admin or has active subscription (Plus/Premium)
    const isPremiumUser = user.role === 'admin' || hasActiveSubscription;

    // If not premium user, check quota
    if (!isPremiumUser) {
      if (user.quickSearchQuota <= 0) {
        return res.status(403).json({
          error: 'Bạn đã hết lượt tra cứu nhanh. Vui lòng nâng cấp Premium để tiếp tục sử dụng.',
          needsUpgrade: true,
          remainingQuota: 0
        });
      }
    }

    // Fetch questions from all selected knowledge bases
    const questions = await prisma.question.findMany({
      where: {
        baseId: {
          in: knowledgeBaseIds
        }
      },
      include: {
        base: {
          select: {
            name: true
          }
        }
      },
      orderBy: [
        { baseId: 'asc' },
        { category: 'asc' }
      ]
    });

    // Transform to client format
    const result = questions.map(q => ({
      id: q.id,
      question: q.text,
      options: JSON.parse(q.options),
      correctAnswerIndex: q.correctAnswerIdx,
      source: q.source || '',
      category: q.category || '',
      knowledgeBaseName: q.base.name
    }));

    // Return current quota (don't decrement here - only decrement on actual search)
    // For premium users (admin or active subscription), don't return quota limit
    const remainingQuota = isPremiumUser ? null : user.quickSearchQuota;

    res.json({ questions: result, remainingQuota });
  } catch (error) {
    console.error('Failed to fetch questions for quick search:', error);
    res.status(500).json({ error: 'Failed to fetch questions' });
  }
});

// Decrement quick search quota
app.post('/api/users/decrement-quick-search-quota', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).session?.passport?.user;

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        quickSearchQuota: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get active subscription
    const activeSubscriptions = await prisma.subscription.findMany({
      where: {
        userId: user.id,
        status: 'active',
        expiresAt: {
          gt: new Date()
        }
      }
    });

    const hasActiveSubscription = activeSubscriptions && activeSubscriptions.length > 0;
    const isPremiumUser = user.role === 'admin' || hasActiveSubscription;

    // Premium users have unlimited searches
    if (isPremiumUser) {
      return res.json({ remainingQuota: -1 });
    }

    // Check if user has quota
    if (user.quickSearchQuota <= 0) {
      return res.status(403).json({
        error: 'Bạn đã hết lượt tra cứu nhanh',
        needsUpgrade: true,
        remainingQuota: 0
      });
    }

    // Decrement quota
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { quickSearchQuota: { decrement: 1 } }
    });

    res.json({ remainingQuota: updatedUser.quickSearchQuota });
  } catch (error) {
    console.error('Failed to decrement quick search quota:', error);
    res.status(500).json({ error: 'Failed to decrement quota' });
  }
});

// Tests assigned to user
app.get('/api/tests', async (req: Request, res: Response) => {
  const email = String(req.query.email || '');
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.json([]);

  // Get tests assigned to this user
  const assignments = await prisma.testAssignment.findMany({
    where: { userId: user.id },
    include: {
      test: {
        include: {
          assignments: {
            include: { user: true }
          }
        }
      }
    }
  });

  // Get completed attempts for each test
  const testIds = assignments.map(a => a.test.id);
  const attemptCounts = await Promise.all(
    testIds.map(async (testId) => {
      const count = await prisma.attempt.count({
        where: {
          testId: testId,
          userId: user.id,
          completedAt: { not: null }
        }
      });
      return { testId, attempts: count };
    })
  );

  const tests = assignments.map(assignment => {
    const test = assignment.test;
    const attemptData = attemptCounts.find(ac => ac.testId === test.id);
    const usedAttempts = attemptData?.attempts || 0;
    const remainingAttempts = test.maxAttempts === 0 ? null : Math.max(0, test.maxAttempts - usedAttempts);

    return {
      id: test.id,
      name: test.name,
      description: test.description,
      questionCount: test.questionCount,
      timeLimit: test.timeLimit,
      maxAttempts: test.maxAttempts,
      usedAttempts: usedAttempts,
      remainingAttempts: remainingAttempts, // null = unlimited, 0 = no attempts left
      startTime: test.startTime,
      endTime: test.endTime,
      isActive: test.isActive,
      createdAt: test.createdAt,
      knowledgeSources: test.knowledgeSources ? JSON.parse(test.knowledgeSources) : [],
      assignedUsers: test.assignments.map(a => ({
        id: a.user.id,
        name: a.user.name,
        email: a.user.email
      }))
    };
  });

  res.json(tests);
});

// Get specific test for taking
app.get('/api/tests/:id', async (req: Request, res: Response) => {
  const testId = req.params.id;
  const email = String(req.query.email || '');
  const viewOnly = req.query.viewOnly === 'true'; // Check if this is for viewing only

  console.log(`[DEBUG] GET /api/tests/${testId} for email: ${email}, viewOnly: ${viewOnly}`);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.log(`[DEBUG] User not found: ${email}`);
    return res.status(404).json({ error: 'User not found' });
  }

  console.log(`[DEBUG] User found: ${user.id}`);

  // Check if user is assigned to this test
  const assignment = await prisma.testAssignment.findFirst({
    where: { testId, userId: user.id },
    include: {
      test: {
        include: {
          assignments: {
            include: { user: true }
          }
        }
      }
    }
  });

  if (!assignment) {
    console.log(`[DEBUG] No assignment found for user ${user.id} and test ${testId}`);
    return res.status(403).json({ error: 'You are not assigned to this test' });
  }

  console.log(`[DEBUG] Assignment found: ${assignment.id}`);

  const test = assignment.test;

  // Check how many attempts user has made for this test
  const existingAttempts = await prisma.attempt.count({
    where: {
      testId: testId,
      userId: user.id,
      completedAt: { not: null } // Only count completed attempts
    }
  });

  // Only check attempt limits if not viewing only
  if (!viewOnly && test.maxAttempts > 0 && existingAttempts >= test.maxAttempts) {
    console.log(`[DEBUG] User has reached max attempts: ${existingAttempts}/${test.maxAttempts}`);
    return res.status(403).json({
      error: `Bạn đã hết lượt thi. Đã thi: ${existingAttempts}/${test.maxAttempts} lượt`,
      attempts: existingAttempts,
      maxAttempts: test.maxAttempts
    });
  }

  console.log(`[DEBUG] User can take test. Attempts: ${existingAttempts}/${test.maxAttempts}`);

  // Check if test is available (time constraints) - only for taking tests, not viewing
  if (!viewOnly) {
    const now = new Date();
    if (test.startTime && new Date(test.startTime) > now) {
      return res.status(403).json({ error: 'Test has not started yet' });
    }
    if (test.endTime && new Date(test.endTime) < now) {
      return res.status(403).json({ error: 'Test has ended' });
    }
  }

  // Get questions for this test based on knowledgeSources
  const knowledgeSources = JSON.parse(test.knowledgeSources);
  const questionOrder = JSON.parse(test.questionOrder);

  // Get all questions from the question IDs
  const questions = await prisma.question.findMany({
    where: { id: { in: questionOrder } }
  });

  // Sort questions according to the predetermined order
  const sortedQuestions = questionOrder.map((id: string) =>
    questions.find(q => q.id === id)
  ).filter(Boolean);

  const testData = {
    id: test.id,
    name: test.name,
    description: test.description,
    questionCount: test.questionCount,
    timeLimit: test.timeLimit,
    maxAttempts: test.maxAttempts,
    currentAttempt: existingAttempts + 1, // Next attempt number
    startTime: test.startTime,
    endTime: test.endTime,
    questions: sortedQuestions.map((q: any) => ({
      id: q!.id,
      question: q!.text,
      options: JSON.parse(q!.options),
      source: q!.source || '',
      category: q!.category || ''
      // Note: We don't include correctAnswerIdx for security
    }))
  };

  res.json(testData);
});

// Get test statistics for a specific user
app.get('/api/tests/:id/statistics', async (req: Request, res: Response) => {
  const testId = req.params.id;
  const email = String(req.query.email || '');

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Check if user is assigned to this test
  const assignment = await prisma.testAssignment.findFirst({
    where: { testId, userId: user.id }
  });

  if (!assignment) {
    return res.status(403).json({ error: 'You are not assigned to this test' });
  }

  // Get all completed attempts for this user and test
  const attempts = await prisma.attempt.findMany({
    where: {
      testId: testId,
      userId: user.id,
      completedAt: { not: null }
    },
    orderBy: { completedAt: 'desc' },
    include: {
      answers: true
    }
  });

  if (attempts.length === 0) {
    return res.json({
      attempts: [],
      bestScore: null,
      fastestTime: null,
      averageScore: null
    });
  }

  // Calculate statistics
  const scores = attempts.map(a => a.score || 0);
  const bestScore = Math.max(...scores);
  const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;

  // Calculate fastest completion time
  let fastestTime: number | null = null;
  for (const attempt of attempts) {
    if (attempt.startedAt && attempt.completedAt) {
      const startTime = new Date(attempt.startedAt).getTime();
      const endTime = new Date(attempt.completedAt).getTime();
      const duration = (endTime - startTime) / 1000; // in seconds

      if (fastestTime === null || duration < fastestTime) {
        fastestTime = duration;
      }
    }
  }

  // Format attempts data
  const formattedAttempts = attempts.map(attempt => ({
    id: attempt.id,
    score: attempt.score,
    completedAt: attempt.completedAt,
    startedAt: attempt.startedAt,
    duration: attempt.startedAt && attempt.completedAt
      ? (new Date(attempt.completedAt).getTime() - new Date(attempt.startedAt).getTime()) / 1000
      : null,
    totalQuestions: attempt.answers.length,
    correctAnswers: attempt.answers.filter(a => a.isCorrect).length
  }));

  res.json({
    attempts: formattedAttempts,
    bestScore,
    fastestTime,
    averageScore: Math.round(averageScore * 100) / 100
  });
});

// Get detailed attempts for a specific test and user
app.get('/api/tests/:id/attempts', async (req: Request, res: Response) => {
  const testId = req.params.id;
  const email = String(req.query.email || '');

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Check if user is assigned to this test
  const assignment = await prisma.testAssignment.findFirst({
    where: { testId, userId: user.id }
  });

  if (!assignment) {
    return res.status(403).json({ error: 'You are not assigned to this test' });
  }

  // Get all attempts for this user and test
  const attempts = await prisma.attempt.findMany({
    where: {
      testId: testId,
      userId: user.id
    },
    orderBy: { startedAt: 'desc' },
    include: {
      answers: true
    }
  });

  const formattedAttempts = attempts.map(attempt => ({
    id: attempt.id,
    score: attempt.score,
    completedAt: attempt.completedAt,
    startedAt: attempt.startedAt,
    duration: attempt.startedAt && attempt.completedAt
      ? (new Date(attempt.completedAt).getTime() - new Date(attempt.startedAt).getTime()) / 1000
      : null,
    totalQuestions: attempt.answers.length,
    correctAnswers: attempt.answers.filter(a => a.isCorrect).length,
    status: attempt.completedAt ? 'completed' : 'in-progress'
  }));

  res.json(formattedAttempts);
});

// Assigned tests for normal user (session based)
app.get('/api/attempts', async (req: Request, res: Response) => {
  const email = String(req.query.email || '');
  const user = await prisma.user.findUnique({ where: { email }, include: { attempts: { include: { answers: true, knowledgeBase: true } } } });
  if (!user) return res.json([]);
  res.json(user.attempts.map(a => ({
    id: a.id,
    mode: a.mode,
    startedAt: a.startedAt,
    completedAt: a.completedAt,
    score: a.score,
    settings: JSON.parse(a.settings),
    knowledgeBaseId: a.knowledgeBaseId,
    knowledgeBaseName: a.knowledgeBase?.name || 'Test Assignment', // Handle null knowledgeBase
    userAnswers: a.answers.map(ans => ({ questionId: ans.questionId, selectedOptionIndex: ans.selectedIndex, isCorrect: ans.isCorrect }))
  })));
});

app.post('/api/attempts', async (req: Request, res: Response) => {
  const { email, attempt } = req.body;
  if (!email || !attempt) return res.status(400).json({ error: 'Invalid' });
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(400).json({ error: 'User not found' });

  let kb = null;
  // Only try to find KB if knowledgeBaseId is provided
  if (attempt.knowledgeBaseId) {
    kb = await prisma.knowledgeBase.findUnique({ where: { id: attempt.knowledgeBaseId }, include: { questions: true } });
  }
  // If testId is provided, validate assignment and derive KB/questions from test
  if (attempt.testId) {
    const test = await (prisma as any).test.findUnique({ where: { id: attempt.testId } });
    if (!test) return res.status(400).json({ error: 'Test not found' });
    const assigned = await (prisma as any).testAssignment.findUnique({ where: { testId_userId: { testId: attempt.testId, userId: user.id } } });
    if (!assigned) return res.status(403).json({ error: 'Not assigned' });

    // For test attempts, we don't need knowledgeBase - questions come from the test
    // Get questions from test's questionOrder
    const questionOrder = JSON.parse(test.questionOrder);
    const questions = await prisma.question.findMany({
      where: { id: { in: questionOrder } }
    });

    // Create a virtual KB object for validation
    kb = { questions };
  }
  if (!kb) return res.status(400).json({ error: 'Knowledge base not found' });
  const questionIdSet = new Set(kb.questions.map(q => q.id));
  for (const ua of attempt.userAnswers) { if (!questionIdSet.has(ua.questionId)) return res.status(400).json({ error: `Question ${ua.questionId} not in base` }); }
  const created = await prisma.attempt.create({
    data: {
      mode: attempt.mode,
      settings: JSON.stringify(attempt.settings),
      userId: user.id,
      knowledgeBaseId: attempt.knowledgeBaseId, // This can be null for test attempts
      testId: attempt.testId, // Store testId for test attempts
      score: attempt.score,
      completedAt: attempt.completedAt ? new Date(attempt.completedAt) : null,
      answers: { create: attempt.userAnswers.map((ua: any) => ({ questionId: ua.questionId, selectedIndex: ua.selectedOptionIndex, isCorrect: ua.isCorrect })) }
    }
  });
  res.json({ id: created.id });
});

app.patch('/api/attempts/:id', async (req: Request, res: Response) => {
  const id = req.params.id;
  const { userAnswers, score, completedAt } = req.body;

  // Get the attempt to check if it's a test attempt
  const attempt = await prisma.attempt.findUnique({
    where: { id }
  });

  if (!attempt) {
    return res.status(404).json({ error: 'Attempt not found' });
  }

  let validatedUserAnswers = userAnswers;
  let validatedScore = score;

  // For test attempts, validate answers server-side
  if (attempt.testId) {
    // Get the questions with correct answers
    const questionIds = userAnswers.map((ua: any) => ua.questionId);
    const questions = await prisma.question.findMany({
      where: { id: { in: questionIds } }
    });

    const questionMap = new Map(questions.map(q => [q.id, q.correctAnswerIdx]));

    // Validate each answer
    validatedUserAnswers = userAnswers.map((ua: any) => {
      const correctAnswerIndex = questionMap.get(ua.questionId);
      const isCorrect = correctAnswerIndex !== undefined && ua.selectedOptionIndex === correctAnswerIndex;
      return {
        ...ua,
        isCorrect
      };
    });

    // Recalculate score based on server validation
    const correctCount = validatedUserAnswers.filter((ua: any) => ua.isCorrect).length;
    const totalCount = validatedUserAnswers.length;
    validatedScore = totalCount > 0 ? parseFloat(((correctCount / totalCount) * 100).toFixed(2)) : 0;
  }

  const updated = await prisma.attempt.update({
    where: { id },
    data: {
      score: validatedScore,
      completedAt: completedAt ? new Date(completedAt) : undefined,
      answers: {
        deleteMany: {},
        create: validatedUserAnswers.map((ua: any) => ({ questionId: ua.questionId, selectedIndex: ua.selectedOptionIndex, isCorrect: ua.isCorrect }))
      }
    }
  });
  res.json({ id: updated.id });
});

// Get quiz results with correct answers (after completion)
app.get('/api/attempts/:id/results', async (req: Request, res: Response) => {
  const attemptId = req.params.id;
  const email = String(req.query.email || '');

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Find the attempt and verify it belongs to the user
  const attempt = await prisma.attempt.findFirst({
    where: {
      id: attemptId,
      userId: user.id,
      completedAt: { not: null } // Only allow results for completed attempts
    },
    include: {
      answers: true
    }
  });

  if (!attempt) {
    return res.status(404).json({ error: 'Completed attempt not found' });
  }

  // Get question details with correct answers
  const questionIds = attempt.answers.map(a => a.questionId);
  const questions = await prisma.question.findMany({
    where: { id: { in: questionIds } }
  });

  // Create a map of question ID to question details
  const questionMap = new Map(questions.map(q => [q.id, {
    id: q.id,
    question: q.text,
    options: JSON.parse(q.options),
    correctAnswerIndex: q.correctAnswerIdx,
    source: q.source || '',
    category: q.category || ''
  }]));

  // Combine question details with user answers, maintaining order
  const results = attempt.answers.map(answer => {
    const question = questionMap.get(answer.questionId);
    return {
      question,
      userAnswer: {
        questionId: answer.questionId,
        selectedOptionIndex: answer.selectedIndex,
        isCorrect: answer.isCorrect
      }
    };
  }).filter(result => result.question); // Filter out any missing questions

  res.json({
    attemptId: attempt.id,
    score: attempt.score,
    completedAt: attempt.completedAt,
    startedAt: attempt.startedAt, // Include start time for duration calculation
    results
  });
});

// Assigned tests for normal user (session based)
function requireAuth(req: Request, res: Response) {
  if (!req.user) { res.status(401).json({ error: 'Unauthenticated' }); return null; }
  return req.user as any;
}

app.get('/api/tests/assigned', async (req: Request, res: Response) => {
  const u = requireAuth(req, res); if (!u) return;
  const assignments = await (prisma as any).testAssignment.findMany({ where: { userId: u.id }, include: { test: true } });
  const result: any[] = [];
  for (const a of assignments) {
    const test = a.test;
    const questionOrder: string[] = JSON.parse(test.questionOrder);
    const questions = await prisma.question.findMany({ where: { id: { in: questionOrder } } });
    const map = new Map(questions.map(q => [q.id, q]));
    const ordered = questionOrder.map(qid => map.get(qid)).filter(Boolean).map(q => ({
      id: q!.id,
      question: q!.text,
      options: JSON.parse(q!.options),
      correctAnswerIndex: q!.correctAnswerIdx,
      source: q!.source || '',
      category: q!.category || ''
    }));
    result.push({ id: test.id, name: test.name, knowledgeBaseId: test.knowledgeBaseId, questionCount: ordered.length, questions: ordered });
  }
  res.json(result);
});

// --- Admin utilities (very light auth check via role) ---
async function requireAdmin(req: Request, res: Response): Promise<User | null> {
  if (!req.user) { res.status(401).json({ error: 'Unauthenticated' }); return null; }
  const u = await prisma.user.findUnique({ where: { id: (req.user as any).id } });
  if (!u || (u as any).role !== 'admin') { res.status(403).json({ error: 'Forbidden' }); return null; }
  return u as any;
}

app.get('/api/admin/users', async (req: Request, res: Response) => {
  const admin = await requireAdmin(req, res); if (!admin) return;

  // Fetch users with their active subscriptions
  const users = await prisma.user.findMany({
    include: {
      subscriptions: {
        where: {
          status: 'active'
        },
        orderBy: {
          expiresAt: 'desc'
        },
        take: 1 // Get the most recent active subscription
      }
    }
  });

  // Transform data to include subscription info
  const usersWithSubscriptions = users.map(user => {
    const activeSubscription = user.subscriptions[0];
    return {
      ...user,
      subscriptionPlan: activeSubscription?.plan || null,
      subscriptionStatus: activeSubscription?.status || null,
      subscriptionExpiresAt: activeSubscription?.expiresAt || null,
      subscriptions: undefined // Remove the subscriptions array from response
    };
  });

  res.json(usersWithSubscriptions);
});

// Create new user
app.post('/api/admin/users', async (req: Request, res: Response) => {
  const admin = await requireAdmin(req, res); if (!admin) return;
  const { username, password, email, name, branchCode, role, aiSearchQuota } = req.body;

  try {
    // Hash password if provided
    let hashedPassword = undefined;
    if (password) {
      const bcrypt = await import('bcrypt');
      hashedPassword = await bcrypt.hash(password, 10);
    }

    // Check for existing user with same username or email
    if (username) {
      const existing = await prisma.user.findUnique({ where: { username } });
      if (existing) {
        return res.status(400).json({ error: 'Username already exists' });
      }
    }
    if (email) {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        return res.status(400).json({ error: 'Email already exists' });
      }
    }

    const newUser = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        email,
        name,
        branchCode,
        role: role || 'user',
        aiSearchQuota: aiSearchQuota !== undefined ? aiSearchQuota : 10
      }
    });

    res.json(newUser);
  } catch (error: any) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: error.message || 'Failed to create user' });
  }
});

// Update user
app.put('/api/admin/users/:id', async (req: Request, res: Response) => {
  const admin = await requireAdmin(req, res); if (!admin) return;
  const { id } = req.params;
  const { username, password, email, name, branchCode, role, aiSearchQuota } = req.body;

  try {
    // Get the target user to check if they are root
    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Root user protection
    const ROOT_USER_EMAIL = 'quangtung1412@gmail.com';
    const isTargetRoot = targetUser.email === ROOT_USER_EMAIL;
    const isAdminRoot = admin.email === ROOT_USER_EMAIL;

    // Only root user can edit root user
    if (isTargetRoot && !isAdminRoot) {
      return res.status(403).json({ error: 'Không thể chỉnh sửa người dùng root' });
    }

    const updateData: any = {};

    if (username !== undefined) updateData.username = username;
    if (email !== undefined) updateData.email = email;
    if (name !== undefined) updateData.name = name;
    if (branchCode !== undefined) updateData.branchCode = branchCode;
    if (role !== undefined) updateData.role = role;
    if (aiSearchQuota !== undefined) updateData.aiSearchQuota = aiSearchQuota;

    // Hash password if provided
    if (password) {
      const bcrypt = await import('bcrypt');
      updateData.password = await bcrypt.hash(password, 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData
    });

    res.json(updatedUser);
  } catch (error: any) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: error.message || 'Failed to update user' });
  }
});

// Delete user
app.delete('/api/admin/users/:id', async (req: Request, res: Response) => {
  const admin = await requireAdmin(req, res); if (!admin) return;
  const { id } = req.params;

  try {
    // Prevent admin from deleting themselves
    if (admin.id === id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    // Get the target user to check if they are root
    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Root user protection
    const ROOT_USER_EMAIL = 'quangtung1412@gmail.com';
    const isTargetRoot = targetUser.email === ROOT_USER_EMAIL;
    const isAdminRoot = admin.email === ROOT_USER_EMAIL;

    // Only root user can delete root user (though deleting self is already blocked above)
    if (isTargetRoot && !isAdminRoot) {
      return res.status(403).json({ error: 'Không thể xóa người dùng root' });
    }

    await prisma.user.delete({
      where: { id }
    });

    res.json({ ok: true });
  } catch (error: any) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: error.message || 'Failed to delete user' });
  }
});

// Admin knowledge base management endpoints
app.get('/api/admin/knowledge-bases', async (req: Request, res: Response) => {
  const admin = await requireAdmin(req, res); if (!admin) return;
  const bases = await prisma.knowledgeBase.findMany({
    include: {
      questions: true,
      user: { select: { email: true, name: true } }
    },
    orderBy: { createdAt: 'desc' }
  });
  const result = bases.map(b => ({
    id: b.id,
    name: b.name,
    createdAt: b.createdAt,
    creatorEmail: b.user.email,
    creatorName: b.user.name,
    questions: b.questions.map(q => ({
      id: q.id,
      question: q.text,
      options: JSON.parse(q.options),
      correctAnswerIndex: q.correctAnswerIdx,
      source: q.source || '',
      category: q.category || ''
    }))
  }));
  res.json(result);
});

app.post('/api/admin/knowledge-bases', async (req: Request, res: Response) => {
  const admin = await requireAdmin(req, res); if (!admin) return;
  const { name, questions, creatorEmail } = req.body;
  if (!name || !Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  // Find or create user for creator
  let user = await prisma.user.findUnique({ where: { email: creatorEmail || admin.email } });
  if (!user) {
    user = await prisma.user.create({ data: { email: creatorEmail || admin.email } });
  }

  const created = await prisma.knowledgeBase.create({
    data: {
      name,
      userId: user.id,
      questions: {
        create: questions.map((q: any) => ({
          text: q.question,
          options: JSON.stringify(q.options || []),
          correctAnswerIdx: q.correctAnswerIndex || 0,
          source: q.source || '',
          category: q.category || ''
        }))
      }
    },
    include: { questions: true }
  });
  res.json({ id: created.id });
});

app.delete('/api/admin/knowledge-bases/:id', async (req: Request, res: Response) => {
  const admin = await requireAdmin(req, res); if (!admin) return;
  const baseId = req.params.id;

  try {
    // Delete all questions first (cascade should handle this but being explicit)
    await prisma.question.deleteMany({ where: { baseId } });

    // Delete the knowledge base
    await prisma.knowledgeBase.delete({ where: { id: baseId } });

    res.json({ ok: true });
  } catch (error) {
    console.error('Failed to delete knowledge base:', error);
    res.status(500).json({ error: 'Failed to delete knowledge base' });
  }
});

app.post('/api/admin/tests', async (req: Request, res: Response) => {
  const admin = await requireAdmin(req, res); if (!admin) return;
  const {
    name,
    description,
    questionCount,
    timeLimit,
    maxAttempts,
    startTime,
    endTime,
    knowledgeSources, // Array of {knowledgeBaseId, percentage}
    assignedUsers = [] // Array of user IDs to assign the test to
  } = req.body;

  if (!name || !questionCount || !timeLimit || !Array.isArray(knowledgeSources)) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Validate that percentages add up to 100
  const totalPercentage = knowledgeSources.reduce((sum: number, source: any) => sum + (source.percentage || 0), 0);
  if (Math.abs(totalPercentage - 100) > 0.01) {
    return res.status(400).json({ error: 'Knowledge source percentages must add up to 100%' });
  }

  try {
    // Generate random questions based on knowledge sources
    const allQuestions: any[] = [];

    for (const source of knowledgeSources) {
      const kb = await prisma.knowledgeBase.findUnique({
        where: { id: source.knowledgeBaseId },
        include: { questions: true }
      });

      if (!kb) {
        return res.status(400).json({ error: `Knowledge base ${source.knowledgeBaseId} not found` });
      }

      const questionsNeeded = Math.round((questionCount * source.percentage) / 100);
      const availableQuestions = kb.questions;

      if (availableQuestions.length < questionsNeeded) {
        return res.status(400).json({
          error: `Knowledge base "${kb.name}" has only ${availableQuestions.length} questions but needs ${questionsNeeded}`
        });
      }

      // Randomly select questions
      const shuffled = availableQuestions.sort(() => 0.5 - Math.random());
      const selectedQuestions = shuffled.slice(0, questionsNeeded);
      allQuestions.push(...selectedQuestions.map(q => q.id));
    }

    // Ensure we have exactly the requested number of questions
    const finalQuestions = allQuestions.slice(0, questionCount);

    // Create the test
    const test = await (prisma as any).test.create({
      data: {
        name,
        description: description || '',
        questionCount,
        timeLimit,
        maxAttempts: maxAttempts || 0, // Default to 0 (unlimited) if not specified
        startTime: startTime ? new Date(startTime) : null,
        endTime: endTime ? new Date(endTime) : null,
        knowledgeSources: JSON.stringify(knowledgeSources),
        questionOrder: JSON.stringify(finalQuestions)
      }
    });

    // Assign test to users if specified
    if (assignedUsers.length > 0) {
      const assignments = assignedUsers.map((userId: string) => ({
        testId: test.id,
        userId
      }));

      for (const assignment of assignments) {
        try {
          await (prisma as any).testAssignment.create({ data: assignment });
        } catch (error) {
          // Ignore duplicate assignments
          console.log('Duplicate assignment ignored:', assignment);
        }
      }
    }

    res.json({ id: test.id });
  } catch (error) {
    console.error('Failed to create test:', error);
    res.status(500).json({ error: 'Failed to create test' });
  }
});

app.post('/api/admin/tests/:id/assign', async (req: Request, res: Response) => {
  const admin = await requireAdmin(req, res); if (!admin) return;
  const testId = req.params.id;
  const { userIds } = req.body;
  if (!Array.isArray(userIds) || userIds.length === 0) return res.status(400).json({ error: 'No users' });
  const test = await (prisma as any).test.findUnique({ where: { id: testId } });
  if (!test) return res.status(404).json({ error: 'Test not found' });
  const data = userIds.map((uid: string) => ({ testId, userId: uid }));
  for (const rec of data) {
    try { await (prisma as any).testAssignment.create({ data: rec }); } catch { /* ignore duplicates */ }
  }
  res.json({ ok: true });
});

app.get('/api/admin/tests', async (req: Request, res: Response) => {
  const admin = await requireAdmin(req, res); if (!admin) return;
  const tests = await (prisma as any).test.findMany({
    include: {
      assignments: { include: { user: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

  res.json((tests as any[]).map((t: any) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    questionCount: t.questionCount,
    timeLimit: t.timeLimit,
    maxAttempts: t.maxAttempts, // Add maxAttempts field
    startTime: t.startTime,
    endTime: t.endTime,
    isActive: t.isActive,
    createdAt: t.createdAt,
    knowledgeSources: JSON.parse(t.knowledgeSources || '[]'),
    assignedUsers: t.assignments.map((a: any) => ({
      id: a.user.id,
      name: a.user.name,
      email: a.user.email
    }))
  })));
});

app.put('/api/admin/tests/:id', async (req: Request, res: Response) => {
  const admin = await requireAdmin(req, res); if (!admin) return;
  const testId = req.params.id;
  const {
    name,
    description,
    questionCount,
    timeLimit,
    maxAttempts,
    startTime,
    endTime,
    knowledgeSources,
    assignedUsers = []
  } = req.body;

  if (!name || !questionCount || !timeLimit || !Array.isArray(knowledgeSources)) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Update the test
    await (prisma as any).test.update({
      where: { id: testId },
      data: {
        name,
        description: description || '',
        questionCount,
        timeLimit,
        maxAttempts: maxAttempts !== undefined ? maxAttempts : 0, // Allow 0, fallback to 0 if undefined
        startTime: startTime ? new Date(startTime) : null,
        endTime: endTime ? new Date(endTime) : null,
        knowledgeSources: JSON.stringify(knowledgeSources)
      }
    });

    // Update assignments
    await (prisma as any).testAssignment.deleteMany({ where: { testId } });

    if (assignedUsers.length > 0) {
      const assignments = assignedUsers.map((userId: string) => ({
        testId,
        userId
      }));

      for (const assignment of assignments) {
        try {
          await (prisma as any).testAssignment.create({ data: assignment });
        } catch (error) {
          console.log('Duplicate assignment ignored:', assignment);
        }
      }
    }

    res.json({ id: testId });
  } catch (error) {
    console.error('Failed to update test:', error);
    res.status(500).json({ error: 'Failed to update test' });
  }
});

app.delete('/api/admin/tests/:id', async (req: Request, res: Response) => {
  const admin = await requireAdmin(req, res); if (!admin) return;
  const testId = req.params.id;

  try {
    // Delete assignments first
    await (prisma as any).testAssignment.deleteMany({ where: { testId } });

    // Delete attempts if any
    await prisma.attempt.deleteMany({ where: { testId } as any });

    // Delete the test
    await (prisma as any).test.delete({ where: { id: testId } });

    res.json({ ok: true });
  } catch (error) {
    console.error('Failed to delete test:', error);
    res.status(500).json({ error: 'Failed to delete test' });
  }
});

// Reset test attempts for a user (for testing purposes)
app.delete('/api/admin/tests/:testId/attempts/:email', async (req: Request, res: Response) => {
  // Temporarily bypass auth for testing
  // const admin = await requireAdmin(req, res); if (!admin) return;
  const { testId, email } = req.params;

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Delete completed attempts for this user and test
    const deletedAttempts = await prisma.attempt.deleteMany({
      where: {
        testId: testId,
        userId: user.id,
        completedAt: { not: null }
      }
    });

    res.json({
      message: `Deleted ${deletedAttempts.count} attempts for ${email}`,
      deletedCount: deletedAttempts.count
    });
  } catch (error) {
    console.error('Failed to reset attempts:', error);
    res.status(500).json({ error: 'Failed to reset attempts' });
  }
});

// Temporarily increase max attempts for demo
app.patch('/api/admin/tests/:testId/increase-attempts', async (req: Request, res: Response) => {
  const { testId } = req.params;
  const { newMax } = req.body;

  try {
    const updatedTest = await (prisma as any).test.update({
      where: { id: testId },
      data: { maxAttempts: newMax || 10 }
    });

    res.json({
      message: `Updated maxAttempts to ${updatedTest.maxAttempts}`,
      test: updatedTest
    });
  } catch (error) {
    console.error('Failed to update maxAttempts:', error);
    res.status(500).json({ error: 'Failed to update maxAttempts' });
  }
});

app.get('/api/admin/tests/:id/ranking', async (req: Request, res: Response) => {
  const admin = await requireAdmin(req, res); if (!admin) return;
  const id = req.params.id;
  const attempts = await prisma.attempt.findMany({ where: { testId: id as any, NOT: { completedAt: null } }, include: { user: true } } as any);
  const ranked = (attempts as any[])
    .map((a: any) => ({ attemptId: a.id, userEmail: a.user.email, score: a.score ?? 0, completedAt: a.completedAt }))
    .sort((a, b) => b.score - a.score);
  res.json(ranked);
});

// Get Gemini model usage statistics (Admin only)
app.get('/api/admin/model-usage', async (req: Request, res: Response) => {
  const admin = await requireAdmin(req, res); if (!admin) return;
  const stats = geminiModelRotation.getUsageStats();
  res.json({
    stats,
    totalModels: stats.length,
    availableModels: stats.filter(s => s.available).length
  });
});

// Reset model usage (Admin only - for testing)
app.post('/api/admin/reset-model-usage', async (req: Request, res: Response) => {
  const admin = await requireAdmin(req, res); if (!admin) return;
  const { modelName } = req.body;

  if (modelName) {
    geminiModelRotation.resetModelUsage(modelName);
    res.json({ message: `Reset usage for ${modelName}` });
  } else {
    geminiModelRotation.resetAllUsage();
    res.json({ message: 'Reset all model usage' });
  }
});

// Get AI search history (Admin only)
app.get('/api/admin/ai-search-history', async (req: Request, res: Response) => {
  const admin = await requireAdmin(req, res); if (!admin) return;

  try {
    const {
      page = 1,
      limit = 50,
      userId,
      username,
      modelUsed,
      success,
      minConfidence,
      maxConfidence,
      startDate,
      endDate
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Build filter conditions
    const where: any = {};

    if (userId) {
      where.userId = parseInt(userId as string);
    }

    // Filter by username or email (SQLite doesn't support mode: 'insensitive', so we remove it)
    if (username) {
      where.user = {
        OR: [
          { username: { contains: username as string } },
          { email: { contains: username as string } },
          { name: { contains: username as string } }
        ]
      };
    }

    if (modelUsed) {
      where.modelUsed = modelUsed as string;
    }

    if (success !== undefined) {
      where.success = success === 'true';
    }

    // Filter by confidence range
    if (minConfidence || maxConfidence) {
      where.confidence = {};
      if (minConfidence) {
        where.confidence.gte = parseFloat(minConfidence as string);
      }
      if (maxConfidence) {
        where.confidence.lte = parseFloat(maxConfidence as string);
      }
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate as string);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate as string);
      }
    }

    // Get history with pagination
    const [history, total] = await Promise.all([
      (prisma as any).aiSearchHistory.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              name: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum
      }),
      (prisma as any).aiSearchHistory.count({ where })
    ]);

    // Get statistics
    const stats = await (prisma as any).aiSearchHistory.groupBy({
      by: ['modelUsed', 'success'],
      _count: { id: true },
      _avg: {
        responseTime: true,
        inputTokens: true,
        outputTokens: true,
        totalTokens: true
      },
      _sum: {
        inputTokens: true,
        outputTokens: true,
        totalTokens: true
      }
    });

    // Calculate total tokens by model
    const modelStats: any = {};
    stats.forEach((stat: any) => {
      if (!modelStats[stat.modelUsed]) {
        modelStats[stat.modelUsed] = {
          total: 0,
          success: 0,
          failed: 0,
          avgResponseTime: 0,
          totalInputTokens: 0,
          totalOutputTokens: 0,
          totalTokens: 0
        };
      }

      const ms = modelStats[stat.modelUsed];
      ms.total += stat._count.id;
      if (stat.success) {
        ms.success += stat._count.id;
      } else {
        ms.failed += stat._count.id;
      }
      ms.avgResponseTime = stat._avg.responseTime || 0;
      ms.totalInputTokens += stat._sum.inputTokens || 0;
      ms.totalOutputTokens += stat._sum.outputTokens || 0;
      ms.totalTokens += stat._sum.totalTokens || 0;
    });

    // Calculate correct success rate from total data
    const successCount = await (prisma as any).aiSearchHistory.count({
      where: { ...where, success: true }
    });

    res.json({
      history,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      },
      stats: {
        byModel: modelStats,
        totalSearches: total,
        successRate: total > 0 ? ((successCount / total) * 100).toFixed(2) : '0'
      }
    });

  } catch (error) {
    console.error('Error fetching AI search history:', error);
    res.status(500).json({ error: 'Failed to fetch AI search history' });
  }
});

// Subscription Plan Management (Admin only)
app.get('/api/admin/subscription-plans', async (req: Request, res: Response) => {
  const admin = await requireAdmin(req, res); if (!admin) return;

  try {
    const plans = await (prisma as any).subscriptionPlan.findMany({
      orderBy: { displayOrder: 'asc' }
    });

    const formattedPlans = plans.map((plan: any) => ({
      ...plan,
      features: JSON.parse(plan.features)
    }));

    res.json(formattedPlans);
  } catch (error) {
    console.error('Error fetching subscription plans:', error);
    res.status(500).json({ error: 'Failed to fetch subscription plans' });
  }
});

app.post('/api/admin/subscription-plans', async (req: Request, res: Response) => {
  const admin = await requireAdmin(req, res); if (!admin) return;

  try {
    const { planId, name, price, aiQuota, duration, features, isActive, displayOrder, popular, bestChoice } = req.body;

    if (!planId || !name || price === undefined || aiQuota === undefined || duration === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const plan = await (prisma as any).subscriptionPlan.create({
      data: {
        planId,
        name,
        price,
        aiQuota,
        duration,
        features: JSON.stringify(features || []),
        isActive: isActive !== undefined ? isActive : true,
        displayOrder: displayOrder || 0,
        popular: popular || false,
        bestChoice: bestChoice || false
      }
    });

    res.json({
      ...plan,
      features: JSON.parse(plan.features)
    });
  } catch (error: any) {
    console.error('Error creating subscription plan:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Plan ID already exists' });
    }
    res.status(500).json({ error: 'Failed to create subscription plan' });
  }
});

app.put('/api/admin/subscription-plans/:id', async (req: Request, res: Response) => {
  const admin = await requireAdmin(req, res); if (!admin) return;

  try {
    const { id } = req.params;
    const { planId, name, price, aiQuota, duration, features, isActive, displayOrder, popular, bestChoice } = req.body;

    const updateData: any = {};
    if (planId !== undefined) updateData.planId = planId;
    if (name !== undefined) updateData.name = name;
    if (price !== undefined) updateData.price = price;
    if (aiQuota !== undefined) updateData.aiQuota = aiQuota;
    if (duration !== undefined) updateData.duration = duration;
    if (features !== undefined) updateData.features = JSON.stringify(features);
    if (isActive !== undefined) updateData.isActive = isActive;
    if (displayOrder !== undefined) updateData.displayOrder = displayOrder;
    if (popular !== undefined) updateData.popular = popular;
    if (bestChoice !== undefined) updateData.bestChoice = bestChoice;

    const plan = await (prisma as any).subscriptionPlan.update({
      where: { id },
      data: updateData
    });

    res.json({
      ...plan,
      features: JSON.parse(plan.features)
    });
  } catch (error: any) {
    console.error('Error updating subscription plan:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Subscription plan not found' });
    }
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Plan ID already exists' });
    }
    res.status(500).json({ error: 'Failed to update subscription plan' });
  }
});

app.delete('/api/admin/subscription-plans/:id', async (req: Request, res: Response) => {
  const admin = await requireAdmin(req, res); if (!admin) return;

  try {
    const { id } = req.params;

    await (prisma as any).subscriptionPlan.delete({
      where: { id }
    });

    res.json({ ok: true });
  } catch (error: any) {
    console.error('Error deleting subscription plan:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Subscription plan not found' });
    }
    res.status(500).json({ error: 'Failed to delete subscription plan' });
  }
});

// ==================== Subscription Management Endpoints ====================

// Get all subscriptions with user info (Admin only)
app.get('/api/admin/subscriptions', async (req: Request, res: Response) => {
  const admin = await requireAdmin(req, res); if (!admin) return;

  try {
    const { status, userId, planId } = req.query;

    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (userId) {
      where.userId = userId;
    }

    if (planId) {
      where.planId = planId;
    }

    const subscriptions = await (prisma as any).subscription.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
            name: true,
            role: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Get all subscription plans to enrich the response
    const plans = await (prisma as any).subscriptionPlan.findMany();
    const planMap = new Map(plans.map((p: any) => [p.planId, p]));

    // Enrich subscriptions with plan details
    const enrichedSubscriptions = subscriptions.map((sub: any) => ({
      ...sub,
      plan: planMap.get(sub.plan) || {
        id: sub.plan,
        name: sub.plan,
        tier: sub.plan,
        price: sub.price,
        durationDays: sub.duration
      }
    }));

    res.json(enrichedSubscriptions);
  } catch (error: any) {
    console.error('Error fetching subscriptions:', error);
    res.status(500).json({ error: 'Failed to fetch subscriptions' });
  }
});

// Create manual subscription (Admin only)
app.post('/api/admin/subscriptions', async (req: Request, res: Response) => {
  const admin = await requireAdmin(req, res); if (!admin) return;

  try {
    const { userId, planId, durationDays, notes } = req.body;

    if (!userId || !planId) {
      return res.status(400).json({ error: 'userId and planId are required' });
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if plan exists
    const plan = await (prisma as any).subscriptionPlan.findUnique({
      where: { planId: planId } // Use planId instead of id
    });

    if (!plan) {
      return res.status(404).json({ error: 'Subscription plan not found' });
    }

    // Use custom duration or plan's default duration
    const days = durationDays || plan.duration;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    const activatedAt = new Date();

    // Generate transaction code
    const transactionCode = `${userId.substring(0, 8)}_${plan.planId}_${Date.now()}`;

    // Create subscription based on actual schema
    const subscription = await (prisma as any).subscription.create({
      data: {
        userId,
        plan: plan.planId, // Store plan ID as string
        price: plan.price,
        aiQuota: plan.aiQuota,
        duration: days,
        status: 'active',
        paymentMethod: 'manual_admin',
        transactionCode,
        activatedAt,
        expiresAt,
        description: notes || `Manually activated by admin ${admin.email || admin.username}`
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
            name: true
          }
        }
      }
    });

    // Enrich with plan details
    const enrichedSubscription = {
      ...subscription,
      plan: {
        id: plan.id,
        name: plan.name,
        tier: plan.planId,
        price: plan.price,
        durationDays: plan.duration
      }
    };

    res.json(enrichedSubscription);
  } catch (error: any) {
    console.error('Error creating subscription:', error);
    res.status(500).json({ error: 'Failed to create subscription' });
  }
});

// Update subscription (Admin only)
app.put('/api/admin/subscriptions/:id', async (req: Request, res: Response) => {
  const admin = await requireAdmin(req, res); if (!admin) return;

  try {
    const { id } = req.params;
    const { status, expiresAt, notes } = req.body;

    // Get current subscription to check if we're activating a pending one
    const currentSub = await (prisma as any).subscription.findUnique({
      where: { id }
    });

    if (!currentSub) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    const data: any = {};

    if (status !== undefined) {
      data.status = status;

      // If activating a pending subscription, auto-set dates
      if (status === 'active' && currentSub.status === 'pending') {
        const now = new Date();
        data.activatedAt = now;

        // Calculate expiry based on duration
        const expiryDate = new Date(now);
        expiryDate.setDate(expiryDate.getDate() + currentSub.duration);
        data.expiresAt = expiryDate;

        // Add activation note
        const activationNote = `\nActivated by admin ${admin.email || admin.username} on ${now.toISOString()}`;
        data.description = (currentSub.description || '') + activationNote;
      }
    }

    // Allow manual expiry date override (only if not auto-activating)
    if (expiresAt !== undefined && !(status === 'active' && currentSub.status === 'pending')) {
      data.expiresAt = expiresAt ? new Date(expiresAt) : null;
    }

    // Allow manual notes update
    if (notes !== undefined && !(status === 'active' && currentSub.status === 'pending')) {
      data.description = notes;
    }

    const subscription = await (prisma as any).subscription.update({
      where: { id },
      data,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
            name: true
          }
        }
      }
    });

    // Enrich with plan details
    const plan = await (prisma as any).subscriptionPlan.findUnique({
      where: { planId: subscription.plan }
    });

    const enrichedSubscription = {
      ...subscription,
      plan: plan ? {
        id: plan.id,
        name: plan.name,
        tier: plan.planId,
        price: plan.price,
        durationDays: plan.duration
      } : {
        id: subscription.plan,
        name: subscription.plan,
        tier: subscription.plan,
        price: subscription.price,
        durationDays: subscription.duration
      }
    };

    res.json(enrichedSubscription);
  } catch (error: any) {
    console.error('Error updating subscription:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Subscription not found' });
    }
    res.status(500).json({ error: 'Failed to update subscription' });
  }
});

// Delete subscription (Admin only)
app.delete('/api/admin/subscriptions/:id', async (req: Request, res: Response) => {
  const admin = await requireAdmin(req, res); if (!admin) return;

  try {
    const { id } = req.params;

    await (prisma as any).subscription.delete({
      where: { id }
    });

    res.json({ ok: true });
  } catch (error: any) {
    console.error('Error deleting subscription:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Subscription not found' });
    }
    res.status(500).json({ error: 'Failed to delete subscription' });
  }
});

// Extend subscription (Admin only)
app.post('/api/admin/subscriptions/:id/extend', async (req: Request, res: Response) => {
  const admin = await requireAdmin(req, res); if (!admin) return;

  try {
    const { id } = req.params;
    const { days } = req.body;

    if (!days || days <= 0) {
      return res.status(400).json({ error: 'Valid days parameter is required' });
    }

    const subscription = await (prisma as any).subscription.findUnique({
      where: { id }
    });

    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    // Extend from current expiry date or now (whichever is later)
    const baseDate = new Date(subscription.expiresAt) > new Date()
      ? new Date(subscription.expiresAt)
      : new Date();

    baseDate.setDate(baseDate.getDate() + days);

    const currentDescription = subscription.description || '';
    const extensionNote = `\nExtended ${days} days by admin ${admin.email || admin.username} on ${new Date().toISOString()}`;

    const updated = await (prisma as any).subscription.update({
      where: { id },
      data: {
        expiresAt: baseDate,
        status: 'active', // Reactivate if it was expired
        description: currentDescription + extensionNote
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
            name: true
          }
        }
      }
    });

    // Enrich with plan details
    const plan = await (prisma as any).subscriptionPlan.findUnique({
      where: { planId: updated.plan }
    });

    const enrichedSubscription = {
      ...updated,
      plan: plan ? {
        id: plan.id,
        name: plan.name,
        tier: plan.planId,
        price: plan.price,
        durationDays: plan.duration
      } : {
        id: updated.plan,
        name: updated.plan,
        tier: updated.plan,
        price: updated.price,
        durationDays: updated.duration
      }
    };

    res.json(enrichedSubscription);
  } catch (error: any) {
    console.error('Error extending subscription:', error);
    res.status(500).json({ error: 'Failed to extend subscription' });
  }
});

// ==================== System Settings Endpoints ====================

// Get system settings (Admin only)
app.get('/api/admin/system-settings', async (req: Request, res: Response) => {
  const admin = await requireAdmin(req, res); if (!admin) return;

  try {
    // Get the first (and should be only) settings record
    let settings = await (prisma as any).systemSettings.findFirst();

    // If no settings exist yet, create default settings
    if (!settings) {
      settings = await (prisma as any).systemSettings.create({
        data: {
          modelRotationEnabled: true,
          defaultModel: 'gemini-2.5-flash',
          peakHoursEnabled: false,
          peakHoursStart: '18:00',
          peakHoursEnd: '22:00',
          peakHoursDays: JSON.stringify([1, 2, 3, 4, 5]) // Monday to Friday
        }
      });
    }

    res.json({
      ...settings,
      peakHoursDays: JSON.parse(settings.peakHoursDays)
    });
  } catch (error: any) {
    console.error('Error fetching system settings:', error);
    res.status(500).json({ error: 'Failed to fetch system settings' });
  }
});

// Update system settings (Admin only)
app.put('/api/admin/system-settings', async (req: Request, res: Response) => {
  const admin = await requireAdmin(req, res); if (!admin) return;

  try {
    const {
      modelRotationEnabled,
      defaultModel,
      peakHoursEnabled,
      peakHoursStart,
      peakHoursEnd,
      peakHoursDays
    } = req.body;

    const updateData: any = {};
    if (modelRotationEnabled !== undefined) updateData.modelRotationEnabled = modelRotationEnabled;
    if (defaultModel !== undefined) updateData.defaultModel = defaultModel;
    if (peakHoursEnabled !== undefined) updateData.peakHoursEnabled = peakHoursEnabled;
    if (peakHoursStart !== undefined) updateData.peakHoursStart = peakHoursStart;
    if (peakHoursEnd !== undefined) updateData.peakHoursEnd = peakHoursEnd;
    if (peakHoursDays !== undefined) updateData.peakHoursDays = JSON.stringify(peakHoursDays);
    updateData.updatedBy = admin.id;

    // Get existing settings or create new one
    let settings = await (prisma as any).systemSettings.findFirst();

    if (settings) {
      settings = await (prisma as any).systemSettings.update({
        where: { id: settings.id },
        data: updateData
      });
    } else {
      settings = await (prisma as any).systemSettings.create({
        data: {
          modelRotationEnabled: modelRotationEnabled ?? true,
          defaultModel: defaultModel ?? 'gemini-2.5-flash',
          peakHoursEnabled: peakHoursEnabled ?? false,
          peakHoursStart: peakHoursStart ?? '18:00',
          peakHoursEnd: peakHoursEnd ?? '22:00',
          peakHoursDays: JSON.stringify(peakHoursDays ?? [1, 2, 3, 4, 5]),
          updatedBy: admin.id
        }
      });
    }

    console.log('[SystemSettings] Updated by admin:', admin.email, updateData);

    res.json({
      ...settings,
      peakHoursDays: JSON.parse(settings.peakHoursDays)
    });
  } catch (error: any) {
    console.error('Error updating system settings:', error);
    res.status(500).json({ error: 'Failed to update system settings' });
  }
});

// ==================== Model Settings Endpoints ====================

// Get model settings (Admin only)
app.get('/api/admin/model-settings', async (req: Request, res: Response) => {
  const admin = await requireAdmin(req, res); if (!admin) return;

  try {
    // Get the first (and should be only) model settings record
    let modelSettings = await (prisma as any).modelSettings.findFirst();

    // If no settings exist yet, create default settings
    if (!modelSettings) {
      modelSettings = await (prisma as any).modelSettings.create({
        data: {
          defaultModel: 'gemini-2.5-flash',
          cheaperModel: 'gemini-2.0-flash-lite',
          embeddingModel: 'gemini-embedding-001'
        }
      });
    }

    res.json(modelSettings);
  } catch (error: any) {
    console.error('Error fetching model settings:', error);
    res.status(500).json({ error: 'Failed to fetch model settings' });
  }
});

// Update model settings (Admin only)
app.put('/api/admin/model-settings', async (req: Request, res: Response) => {
  const admin = await requireAdmin(req, res); if (!admin) return;

  try {
    const {
      defaultModel,
      cheaperModel,
      embeddingModel
    } = req.body;

    const updateData: any = {};
    if (defaultModel !== undefined) updateData.defaultModel = defaultModel;
    if (cheaperModel !== undefined) updateData.cheaperModel = cheaperModel;
    if (embeddingModel !== undefined) updateData.embeddingModel = embeddingModel;
    updateData.updatedBy = admin.email;

    // Get existing settings or create new one
    let modelSettings = await (prisma as any).modelSettings.findFirst();

    if (modelSettings) {
      modelSettings = await (prisma as any).modelSettings.update({
        where: { id: modelSettings.id },
        data: updateData
      });
    } else {
      modelSettings = await (prisma as any).modelSettings.create({
        data: {
          defaultModel: defaultModel ?? 'gemini-2.5-flash',
          cheaperModel: cheaperModel ?? 'gemini-2.0-flash-lite',
          embeddingModel: embeddingModel ?? 'gemini-embedding-001',
          updatedBy: admin.email
        }
      });
    }

    console.log('[ModelSettings] Updated by admin:', admin.email, updateData);

    // Refresh the model settings cache
    await modelSettingsService.refresh();

    res.json(modelSettings);
  } catch (error: any) {
    console.error('Error updating model settings:', error);
    res.status(500).json({ error: 'Failed to update model settings' });
  }
});

// Public endpoint to get peak hours status (for client-side checks)
app.get('/api/peak-hours-status', async (req: Request, res: Response) => {
  try {
    const settings = await (prisma as any).systemSettings.findFirst();

    if (!settings || !settings.peakHoursEnabled) {
      return res.json({ isPeakHours: false, enabled: false });
    }

    const now = new Date();
    const currentDay = now.getDay(); // 0 = Sunday, 6 = Saturday
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const peakDays = JSON.parse(settings.peakHoursDays);
    const isDayMatch = peakDays.includes(currentDay);
    const isTimeMatch = currentTime >= settings.peakHoursStart && currentTime <= settings.peakHoursEnd;

    res.json({
      isPeakHours: isDayMatch && isTimeMatch,
      enabled: settings.peakHoursEnabled,
      peakHoursStart: settings.peakHoursStart,
      peakHoursEnd: settings.peakHoursEnd,
      peakHoursDays: peakDays
    });
  } catch (error: any) {
    console.error('Error checking peak hours status:', error);
    res.json({ isPeakHours: false, enabled: false });
  }
});

// Public endpoint to get active subscription plans
app.get('/api/subscription-plans', async (req: Request, res: Response) => {
  try {
    const plans = await (prisma as any).subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' }
    });

    const formattedPlans = plans.map((plan: any) => ({
      id: plan.planId,
      planId: plan.planId,
      name: plan.name,
      price: plan.price,
      priceText: `${(plan.price / 1000).toFixed(0)}.000đ`,
      aiQuota: plan.aiQuota,
      duration: plan.duration,
      durationText: plan.duration === 30 ? '30 ngày' : plan.duration === 365 ? '1 năm' : `${plan.duration} ngày`,
      features: JSON.parse(plan.features),
      popular: plan.popular,
      bestChoice: plan.bestChoice
    }));

    res.json(formattedPlans);
  } catch (error) {
    console.error('Error fetching subscription plans:', error);
    res.status(500).json({ error: 'Failed to fetch subscription plans' });
  }
});


const port = parseInt(process.env.PORT || '3000', 10);

// Initialize Qdrant service before starting server
(async () => {
  try {
    console.log('[RAG] Initializing Qdrant service...');
    await qdrantService.initialize();
    console.log('[RAG] Qdrant service initialized successfully');
  } catch (error) {
    console.error('[RAG] Failed to initialize Qdrant:', error);
    console.error('[RAG] RAG features will be disabled');
  }
})();

httpServer.listen(port, () => {
  console.log('API server on :' + port);
  console.log('Socket.IO enabled for real-time updates');
});

// Initialize Telegram Bot for subscription management
(async () => {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (botToken && chatId) {
      const TelegramBot = (await import('node-telegram-bot-api')).default;
      // const bot = new TelegramBot(botToken, { polling: true });
      const bot = new TelegramBot(botToken, { polling: false });

      console.log('✅ Telegram Bot started');

      // Handle /activate command
      bot.onText(/\/activate (.+)/, async (msg, match) => {
        const subscriptionId = match?.[1];

        if (!subscriptionId) {
          bot.sendMessage(msg.chat.id, '❌ Vui lòng cung cấp ID subscription');
          return;
        }

        try {
          // Get subscription
          const subscription = await (prisma as any).subscription.findUnique({
            where: { id: subscriptionId },
            include: { user: true }
          });

          if (!subscription) {
            bot.sendMessage(msg.chat.id, '❌ Không tìm thấy subscription');
            return;
          }

          if (subscription.status === 'active') {
            bot.sendMessage(msg.chat.id, '⚠️ Subscription đã được kích hoạt rồi');
            return;
          }

          const now = new Date();
          const expiresAt = new Date(now.getTime() + subscription.duration * 24 * 60 * 60 * 1000);

          // Activate subscription
          await (prisma as any).subscription.update({
            where: { id: subscriptionId },
            data: {
              status: 'active',
              activatedAt: now,
              expiresAt: expiresAt
            }
          });

          // Update user
          await prisma.user.update({
            where: { id: subscription.userId },
            data: {
              aiSearchQuota: { increment: subscription.aiQuota },
              pendingThankYouPopup: 1 // Set flag to show thank you popup on next homepage visit
            }
          });

          const responseMessage = `✅ ĐÃ KÍCH HOẠT THÀNH CÔNG\n\n` +
            `👤 User: ${subscription.user.name || subscription.user.username || subscription.user.email}\n` +
            `📦 Gói: ${subscription.plan.toUpperCase()}\n` +
            `🎁 +${subscription.aiQuota} lượt AI search\n` +
            `✨ Mở khóa tra cứu không giới hạn\n` +
            `⏰ Hết hạn: ${expiresAt.toLocaleDateString('vi-VN')}`;

          bot.sendMessage(msg.chat.id, responseMessage);
        } catch (error) {
          console.error('Activation error:', error);
          bot.sendMessage(msg.chat.id, '❌ Lỗi khi kích hoạt subscription');
        }
      });

      // Handle /cancel command
      bot.onText(/\/cancel (.+)/, async (msg, match) => {
        const subscriptionId = match?.[1];

        if (!subscriptionId) {
          bot.sendMessage(msg.chat.id, '❌ Vui lòng cung cấp ID subscription');
          return;
        }

        try {
          await (prisma as any).subscription.update({
            where: { id: subscriptionId },
            data: { status: 'cancelled' }
          });

          bot.sendMessage(msg.chat.id, '✅ Đã hủy yêu cầu');
        } catch (error) {
          console.error('Cancel error:', error);
          bot.sendMessage(msg.chat.id, '❌ Lỗi khi hủy subscription');
        }
      });

      // Handle /help command
      bot.onText(/\/help/, (msg) => {
        const helpText = `📚 HƯỚNG DẪN SỬ DỤNG BOT\n\n` +
          `/activate <id> - Kích hoạt subscription\n` +
          `/cancel <id> - Hủy yêu cầu subscription\n` +
          `/help - Xem hướng dẫn`;

        bot.sendMessage(msg.chat.id, helpText);
      });

    } else {
      // console.log('⚠️ Telegram Bot not configured (missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID)');
    }
  } catch (error) {
    // console.error('❌ Telegram Bot initialization error:', error);
  }
})();


// Get user info including AI quota
app.get('/api/user/me', async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        role: true,
        aiSearchQuota: true,
        quickSearchQuota: true
      }
    });

    if (!dbUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get active subscription from Subscription table
    const activeSubscription = await getActiveSubscription(user.id);

    // Build response with premium info from subscription
    // Admin users automatically get premium benefits
    const userWithPremium = {
      ...dbUser,
      isPremium: dbUser.role === 'admin' || !!activeSubscription,
      premiumPlan: dbUser.role === 'admin' ? 'premium' : (activeSubscription?.plan || null),
      premiumExpiresAt: dbUser.role === 'admin' ? null : (activeSubscription?.expiresAt || null),
      hasQuickSearchAccess: dbUser.role === 'admin' || !!activeSubscription, // Admin and premium users have quick search access
      quickSearchQuota: dbUser.quickSearchQuota
    };

    res.json(userWithPremium);
  } catch (error) {
    console.error('Error fetching user info:', error);
    res.status(500).json({ error: 'Failed to fetch user info' });
  }
});

// Subscription APIs
app.post('/api/subscriptions/purchase', async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { plan, transactionCode } = req.body;

    if (!plan || !transactionCode) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate plan
    const planDetails: { [key: string]: { price: number; aiQuota: number; duration: number } } = {
      plus: { price: 50000, aiQuota: 100, duration: 30 },
      premium: { price: 500000, aiQuota: 1500, duration: 365 }
    };

    if (!planDetails[plan]) {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    const details = planDetails[plan];

    // Create subscription
    const subscription = await (prisma as any).subscription.create({
      data: {
        userId: user.id,
        plan: plan,
        price: details.price,
        aiQuota: details.aiQuota,
        duration: details.duration,
        transactionCode: transactionCode,
        status: 'pending'
      }
    });

    // Send notification to Telegram
    try {
      const TelegramBot = (await import('node-telegram-bot-api')).default;
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      const chatId = process.env.TELEGRAM_CHAT_ID;

      if (botToken && chatId) {
        const bot = new TelegramBot(botToken);

        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { username: true, email: true, name: true }
        });

        const message = `🛒 YÊU CẦU MUA GÓI PREMIUM\n\n` +
          `👤 User: ${dbUser?.name || dbUser?.username || dbUser?.email}\n` +
          `📧 Email: ${dbUser?.email || 'N/A'}\n` +
          `📦 Gói: ${plan.toUpperCase()}\n` +
          `💰 Giá: ${details.price.toLocaleString('vi-VN')}đ\n` +
          `🔢 Mã GD: ${transactionCode}\n` +
          `📅 Thời gian: ${new Date().toLocaleString('vi-VN')}\n\n` +
          `Để kích hoạt, trả lời: /activate ${subscription.id}`;

        const sentMessage = await bot.sendMessage(chatId, message);

        // Send separate message with just the activation command for easy copy
        const commandMessage = `/activate ${subscription.id}`;
        await bot.sendMessage(chatId, commandMessage);

        // Update subscription with telegram message ID
        await (prisma as any).subscription.update({
          where: { id: subscription.id },
          data: { telegramMessageId: sentMessage.message_id.toString() }
        });
      }
    } catch (telegramError) {
      console.error('Telegram notification error:', telegramError);
      // Continue even if telegram fails
    }

    res.json({
      success: true,
      subscriptionId: subscription.id,
      message: 'Yêu cầu đã được gửi thành công'
    });

  } catch (error) {
    console.error('Purchase error:', error);
    res.status(500).json({ error: 'Failed to create subscription' });
  }
});

app.post('/api/subscriptions/activate', async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin only' });
    }

    const { subscriptionId } = req.body;

    if (!subscriptionId) {
      return res.status(400).json({ error: 'Missing subscriptionId' });
    }

    // Get subscription
    const subscription = await (prisma as any).subscription.findUnique({
      where: { id: subscriptionId }
    });

    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    if (subscription.status === 'active') {
      return res.status(400).json({ error: 'Subscription already active' });
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + subscription.duration * 24 * 60 * 60 * 1000);

    // Activate subscription
    await (prisma as any).subscription.update({
      where: { id: subscriptionId },
      data: {
        status: 'active',
        activatedAt: now,
        expiresAt: expiresAt
      }
    });

    // Update user with AI quota (premium info comes from active subscription)
    await prisma.user.update({
      where: { id: subscription.userId },
      data: {
        aiSearchQuota: { increment: subscription.aiQuota },
        pendingThankYouPopup: 1 // Set flag to show thank you popup on next homepage visit
      }
    });

    res.json({
      success: true,
      message: 'Subscription activated successfully'
    });

  } catch (error) {
    console.error('Activation error:', error);
    res.status(500).json({ error: 'Failed to activate subscription' });
  }
});

// Premium API - Image Search with Gemini
app.post('/api/premium/search-by-image', async (req: Request, res: Response) => {
  // Variables for error logging
  let startTime = 0;
  let user: any = null;
  let knowledgeBaseIds: any[] = [];
  let selectedModel: any = null;

  try {
    user = req.user as any;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    // Check AI search quota
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { aiSearchQuota: true, role: true }
    });

    if (!dbUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Admin has unlimited quota
    if (dbUser.role !== 'admin' && dbUser.aiSearchQuota <= 0) {
      return res.status(403).json({
        error: 'Bạn đã hết lượt tìm kiếm AI. Vui lòng nạp thêm để tiếp tục sử dụng.',
        quota: 0
      });
    }

    const { image, knowledgeBaseIds: kbIds } = req.body;
    knowledgeBaseIds = kbIds;

    if (!image || !knowledgeBaseIds || !Array.isArray(knowledgeBaseIds)) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if GEMINI_API_KEY is configured
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
      console.error('GEMINI_API_KEY not configured');
      return res.status(500).json({ error: 'GEMINI_API_KEY chưa được cấu hình. Vui lòng thêm API key vào file .env' });
    }

    // Import Gemini AI (new SDK)
    const { GoogleGenAI } = await import('@google/genai');
    const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    // Check system settings for model rotation
    const systemSettings = await (prisma as any).systemSettings.findFirst();

    if (systemSettings && !systemSettings.modelRotationEnabled) {
      // Model rotation is disabled - use default model from model settings
      const defaultModelName = await modelSettingsService.getDefaultModel();
      console.log(`[AI Search] Model rotation DISABLED - Using default model: ${defaultModelName}`);
      selectedModel = {
        name: defaultModelName,
        priority: 0,
        rpm: 999,  // High dummy value - not tracked when rotation disabled
        rpd: 999,  // High dummy value - not tracked when rotation disabled
        tpm: 999999,
        category: 'Default Model'
      };
    } else {
      // Model rotation is enabled - using free tier models with quota management
      // Need to track and enforce RPM/RPD limits for free models
      console.log(`[AI Search] Model rotation ENABLED - Using free tier with quota management`);
      selectedModel = geminiModelRotation.getNextAvailableModel();
      if (!selectedModel) {
        return res.status(503).json({
          error: 'Tất cả các model AI (free tier) đã đạt giới hạn. Vui lòng thử lại sau ít phút.',
          usageStats: geminiModelRotation.getUsageStats()
        });
      }
      console.log(`[AI Search] Using model from rotation: ${selectedModel.name} (priority ${selectedModel.priority})`);
    }

    // Convert base64 to proper format for Gemini
    const imagePart = {
      inlineData: {
        data: image,
        mimeType: 'image/jpeg',
      },
    };

    // Prompt for Gemini to extract question text in structured JSON format
    const prompt = `Hãy trích xuất văn bản từ ảnh này và trả về CHÍNH XÁC theo định dạng JSON sau:

{
  "question": "Nội dung câu hỏi (không bao gồm A, B, C, D)",
  "optionA": "Nội dung đáp án A (nếu có)",
  "optionB": "Nội dung đáp án B (nếu có)",
  "optionC": "Nội dung đáp án C (nếu có)",
  "optionD": "Nội dung đáp án D (nếu có)"
}

QUY TẮC:
- Chỉ trả về JSON, KHÔNG thêm markdown code block hay giải thích
- "question" chỉ chứa NỘI DUNG CÂU HỎI, bỏ qua phần đáp án A/B/C/D
- Giữ nguyên dấu câu, chính tả
- Nếu không có đáp án nào, để giá trị rỗng ""
- Không thêm văn bản không có trong ảnh

Ví dụ:
{"question":"Agribank được thành lập năm nào?","optionA":"1988","optionB":"1990","optionC":"1995","optionD":"2000"}`;

    const startTime = Date.now(); // Track response time
    const result = await genAI.models.generateContent({
      model: selectedModel.name,
      contents: [prompt, imagePart],
    });
    const responseTime = Date.now() - startTime; // Calculate response time

    let responseText = (result.text || '').trim();

    // Record successful request for rate limiting (ONLY if rotation is enabled)
    // When rotation is DISABLED: We assume using paid/upgraded model with high limits,
    // so no need to track RPM/RPD quotas
    // When rotation is ENABLED: We use free tier models, so must track quotas to avoid hitting limits
    if (!systemSettings || systemSettings.modelRotationEnabled) {
      geminiModelRotation.recordRequest(selectedModel.name);
      console.log(`[AI Search] Recorded request for quota tracking (free tier mode)`);
    } else {
      console.log(`[AI Search] Skipped quota tracking (paid/upgraded model mode)`);
    }

    // Get token usage from response
    const usageMetadata = (result as any).usageMetadata || {};
    const inputTokens = usageMetadata.promptTokenCount || 0;
    const outputTokens = usageMetadata.candidatesTokenCount || 0;
    const totalTokens = usageMetadata.totalTokenCount || (inputTokens + outputTokens);

    // Remove markdown code blocks if present
    responseText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let extractedData: any;
    try {
      extractedData = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', responseText);
      // Fallback: treat as plain text
      extractedData = {
        question: responseText,
        optionA: '',
        optionB: '',
        optionC: '',
        optionD: ''
      };
    }

    const recognizedText = extractedData.question || responseText;

    console.log('AI Extracted Data:', extractedData);

    // Search for matching question in selected knowledge bases
    const questions = await prisma.question.findMany({
      where: {
        baseId: {
          in: knowledgeBaseIds
        }
      },
      include: {
        base: {
          select: {
            name: true
          }
        }
      }
    });

    // Enhanced matching logic - compare both question and answer options
    let bestMatch: any = null;
    let bestScore = 0;

    // Simple normalization
    const normalizeText = (text: string) => {
      return text.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove Vietnamese accents
        .replace(/đ/g, 'd')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    };

    const recognizedNormalized = normalizeText(recognizedText);
    const extractedOptionsNormalized = {
      A: extractedData.optionA ? normalizeText(extractedData.optionA) : '',
      B: extractedData.optionB ? normalizeText(extractedData.optionB) : '',
      C: extractedData.optionC ? normalizeText(extractedData.optionC) : '',
      D: extractedData.optionD ? normalizeText(extractedData.optionD) : ''
    };

    // Get list of extracted options (non-empty ones)
    const extractedOptionsList = Object.values(extractedOptionsNormalized).filter(opt => opt.length > 0);

    // Store all matches with scores
    const allMatches: Array<{ question: any; score: number; matchType: string }> = [];

    for (const question of questions) {
      const questionNormalized = normalizeText(question.text);
      const questionOptions = JSON.parse(question.options);
      const questionOptionsNormalized = questionOptions.map((opt: string) => normalizeText(opt));

      let matchScore = 0;
      let matchType = '';

      // Strategy 1: Question exact match (80% weight)
      let questionMatchScore = 0;
      if (questionNormalized === recognizedNormalized) {
        questionMatchScore = 1.0;
      } else if (questionNormalized.includes(recognizedNormalized) || recognizedNormalized.includes(questionNormalized)) {
        questionMatchScore = 0.9;
      } else {
        // Word-based matching for question
        const recognizedWords = recognizedNormalized.split(' ').filter(w => w.length > 2);
        const questionWords = questionNormalized.split(' ').filter(w => w.length > 2);

        if (recognizedWords.length > 0 && questionWords.length > 0) {
          const matchingWords = recognizedWords.filter(word => questionWords.includes(word));
          questionMatchScore = matchingWords.length / Math.max(recognizedWords.length, questionWords.length);
        }
      }

      // Strategy 2: Answer options matching (20% weight + bonus for multiple matches)
      let optionsMatchScore = 0;
      let matchedOptionsCount = 0;

      if (extractedOptionsList.length > 0) {
        for (const extractedOption of extractedOptionsList) {
          for (const dbOption of questionOptionsNormalized) {
            if (extractedOption === dbOption) {
              matchedOptionsCount++;
              optionsMatchScore = Math.max(optionsMatchScore, 1.0);
              break;
            } else if (extractedOption.includes(dbOption) || dbOption.includes(extractedOption)) {
              matchedOptionsCount++;
              optionsMatchScore = Math.max(optionsMatchScore, 0.8);
              break;
            }
          }
        }

        // Bonus for matching multiple options (indicates correct question even if options are scrambled)
        if (matchedOptionsCount >= 2) {
          optionsMatchScore += 0.2; // Bonus for multiple option matches
          matchType = 'question+options';
        } else if (matchedOptionsCount >= 1) {
          matchType = 'question+option';
        }
      }

      // Combined score: 80% question + 20% options
      if (questionMatchScore > 0.4 || optionsMatchScore > 0.6) { // Minimum threshold
        matchScore = (questionMatchScore * 0.8) + (optionsMatchScore * 0.2);

        if (matchType === '') {
          matchType = questionMatchScore > 0.8 ? 'question-exact' : 'question-partial';
        }

        allMatches.push({ question, score: matchScore, matchType });
      }
    }

    // Sort by score and get top matches
    allMatches.sort((a, b) => b.score - a.score);
    bestMatch = allMatches.length > 0 ? allMatches[0].question : null;
    bestScore = allMatches.length > 0 ? allMatches[0].score : 0;

    // Log for debugging
    console.log('=== IMAGE SEARCH DEBUG ===');
    console.log('Recognized Question:', recognizedText);
    console.log('Extracted Options:', {
      A: extractedData.optionA || 'N/A',
      B: extractedData.optionB || 'N/A',
      C: extractedData.optionC || 'N/A',
      D: extractedData.optionD || 'N/A'
    });
    console.log('Total questions in DB:', questions.length);
    console.log('Matches found:', allMatches.length);
    console.log('Top 3 matches:', allMatches.slice(0, 3).map(m => ({
      score: Math.round(m.score * 100) + '%',
      matchType: m.matchType,
      questionPreview: m.question.text.substring(0, 80) + '...'
    })));
    console.log('========================');

    // Prepare alternative matches (top 3)
    const alternativeMatches = allMatches.slice(1, 4).map(match => ({
      id: match.question.id,
      question: match.question.text,
      options: JSON.parse(match.question.options),
      correctAnswerIndex: match.question.correctAnswerIdx,
      source: match.question.source || '',
      category: match.question.category || '',
      knowledgeBaseName: match.question.base.name,
      confidence: Math.round(match.score * 100),
      matchType: match.matchType
    }));

    let result_data: any = {
      recognizedText: recognizedText,
      extractedOptions: extractedData.optionA ? {
        A: extractedData.optionA,
        B: extractedData.optionB,
        C: extractedData.optionC,
        D: extractedData.optionD
      } : undefined,
      matchedQuestion: bestMatch ? {
        id: bestMatch.id,
        question: bestMatch.text,
        options: JSON.parse(bestMatch.options),
        correctAnswerIndex: bestMatch.correctAnswerIdx,
        source: bestMatch.source || '',
        category: bestMatch.category || '',
        knowledgeBaseName: bestMatch.base.name
      } : null,
      confidence: Math.round(bestScore * 100),
      alternativeMatches: alternativeMatches.length > 0 ? alternativeMatches : undefined,
      modelUsed: selectedModel.name,
      modelPriority: selectedModel.priority,
      searchType: 'database'
    };

    // Smart Search Strategy: If no good match found in database (confidence < 70%), try RAG search
    if (!bestMatch || bestScore < 0.7) {
      console.log('=== RAG SEARCH INITIATED ===');
      console.log('Best DB match confidence:', Math.round(bestScore * 100) + '%');
      console.log('Switching to RAG search for better accuracy...');

      try {
        // Import RAG services (dynamic import to avoid circular dependencies)
        const { ragRouterService } = await import('./services/rag-router.service.js');

        // Check RAG configuration
        const ragConfig = await ragRouterService.getRAGConfig();
        const useFileSearch = ragConfig.method === 'google-file-search';

        console.log(`[RAG Search] Using method: ${ragConfig.method}${useFileSearch ? ` (store: ${ragConfig.fileSearchStoreName})` : ''}`);

        if (useFileSearch) {
          // Use File Search directly via RAG Router
          const ragQuery = {
            question: `Dựa trên câu hỏi: "${recognizedText}"
                      ${extractedData.optionA ? `\nCác đáp án: A) ${extractedData.optionA}, B) ${extractedData.optionB}, C) ${extractedData.optionC}, D) ${extractedData.optionD}` : ''}
                      
                      Hãy phân tích và trả về CHÍNH XÁC theo định dạng JSON:
                      {
                        "correctAnswer": "A/B/C/D (chọn đáp án đúng)",
                        "explanation": "Lý do ngắn gọn",
                        "source": "Số điều, số văn bản hoặc quy định cụ thể",
                        "confidence": "số từ 1-100"
                      }
                      
                      Chỉ trả về JSON, không giải thích dài dòng. Nếu không có đáp án A/B/C/D thì trả về câu trả lời ngắn gọn trong trường "correctAnswer".`,
            topK: 10
          };

          const ragResponse = await ragRouterService.processQuery(ragQuery);

          // Add RAG result to response
          result_data.ragResult = {
            answer: ragResponse.answer,
            confidence: ragResponse.confidence,
            sources: ragResponse.sources,
            model: ragResponse.model,
            chunksUsed: ragResponse.sources?.length || 0,
            structured: ragResponse.structured || false,
            method: 'google-file-search'
          };

          const isHighConfidence = ragResponse.confidence >= 80;
          if (isHighConfidence) {
            result_data.searchType = 'rag-primary';
            console.log(`[RAG Search] ✅ High confidence File Search result (${ragResponse.confidence}%)`);
          } else {
            result_data.searchType = 'rag-fallback';
            console.log(`[RAG Search] ⚠️ Lower confidence File Search result (${ragResponse.confidence}%)`);
          }

          result_data.matchedQuestion = null;
          result_data.confidence = ragResponse.confidence;
        } else {
          // Use Qdrant method (existing code)
          const { geminiRAGService } = await import('./services/gemini-rag.service.js');
          const { qdrantService } = await import('./services/qdrant.service.js');

          // Generate embedding for the recognized question
          const questionEmbedding = await geminiRAGService.generateEmbedding(recognizedText);

          // Get all available collections for comprehensive search
          const availableCollections = await qdrantService.listCollections();
          const collectionNames = availableCollections.map(c => c.name);

          console.log(`[RAG Search] Available collections:`, collectionNames);

          // For image search, we do comprehensive search across all collections
          let ragSearchResults: any[] = [];
          if (collectionNames.length > 1) {
            console.log(`[RAG Search] Searching across multiple collections`);
            ragSearchResults = await qdrantService.searchMultipleCollections(
              questionEmbedding,
              collectionNames,
              { topK: 10, minScore: 0.4 }
            );
          } else if (collectionNames.length === 1) {
            console.log(`[RAG Search] Searching in single collection:`, collectionNames[0]);
            ragSearchResults = await qdrantService.search(
              questionEmbedding,
              {
                topK: 10,
                minScore: 0.4,
                collectionName: collectionNames[0]
              }
            );
          } else {
            console.log(`[RAG Search] No collections available`);
            ragSearchResults = [];
          }

          console.log(`[RAG Search] Found ${ragSearchResults.length} RAG chunks`);

          if (ragSearchResults.length > 0) {
            // Apply reranking for better relevance
            ragSearchResults = qdrantService.rerankResults(ragSearchResults, recognizedText, {
              keywordWeight: 0.1,
              maxPerDocument: 3,
            });

            // Take top 8 after reranking for focused answer
            ragSearchResults = ragSearchResults.slice(0, 8);

            // Prepare retrieved chunks for RAG
            const retrievedChunks = ragSearchResults.map((result) => ({
              chunkId: result.id,
              content: result.payload.content,
              documentId: result.payload.documentId,
              documentName: result.payload.documentName,
              documentNumber: result.payload.documentNumber,
              score: result.score,
              metadata: {
                documentId: result.payload.documentId,
                documentNumber: result.payload.documentNumber,
                documentName: result.payload.documentName,
                documentType: result.payload.documentType,
                chapterNumber: result.payload.chapterNumber,
                chapterTitle: result.payload.chapterTitle,
                articleNumber: result.payload.articleNumber,
                articleTitle: result.payload.articleTitle,
                sectionNumber: result.payload.sectionNumber,
                chunkType: result.payload.chunkType,
                chunkIndex: result.payload.chunkIndex,
              },
            }));

            // Generate RAG answer with optimized prompt for image-extracted questions
            const ragQuery = {
              question: `Dựa trên câu hỏi: "${recognizedText}"
                        ${extractedData.optionA ? `\nCác đáp án: A) ${extractedData.optionA}, B) ${extractedData.optionB}, C) ${extractedData.optionC}, D) ${extractedData.optionD}` : ''}
                        
                        Hãy phân tích và trả về CHÍNH XÁC theo định dạng JSON:
                        {
                          "correctAnswer": "A/B/C/D (chọn đáp án đúng)",
                          "explanation": "Lý do ngắn gọn",
                          "source": "Số điều, số văn bản hoặc quy định cụ thể",
                          "confidence": "số từ 1-100"
                        }
                        
                        Chỉ trả về JSON, không giải thích dài dòng. Nếu không có đáp án A/B/C/D thì trả về câu trả lời ngắn gọn trong trường "correctAnswer".`,
              topK: ragSearchResults.length
            };

            const ragResponse = await geminiRAGService.generateRAGAnswer(ragQuery, retrievedChunks);

            // Add RAG result to response using structured format from service
            result_data.ragResult = {
              answer: ragResponse.answer,
              confidence: ragResponse.confidence,
              sources: ragResponse.sources,
              model: ragResponse.model,
              chunksUsed: ragSearchResults.length,
              structured: ragResponse.structured || false,
              method: 'qdrant'
            };

            // When RAG search is successful and has high confidence, treat as primary result
            const isHighConfidence = ragResponse.confidence >= 80;
            if (isHighConfidence) {
              result_data.searchType = 'rag-primary';
              console.log(`[RAG Search] ✅ High confidence result (${ragResponse.confidence}%), using as primary answer`);
            } else {
              result_data.searchType = 'rag-fallback';
              console.log(`[RAG Search] ⚠️ Lower confidence result (${ragResponse.confidence}%), using as fallback answer`);
            }

            result_data.matchedQuestion = null; // Hide database match to show RAG results
            result_data.confidence = ragResponse.confidence; // Use RAG confidence

            console.log(`[RAG Search] Search successful, confidence: ${ragResponse.confidence}%`);
            console.log(`[RAG Search] Sources used:`, ragResponse.sources?.slice(0, 3).map(s => s.documentName));
            if (isHighConfidence) {
              console.log('[RAG Search] High confidence result - showing RAG results as primary answer');
            } else {
              console.log('[RAG Search] Database results hidden, showing RAG results as fallback');
            }
          } else {
            console.log('[RAG Search] No RAG chunks found');
            result_data.ragResult = null;
          }
        }
      } catch (ragError) {
        console.error('[RAG Search] Search failed:', ragError);
        result_data.ragResult = null;
        result_data.ragError = 'RAG search không khả dụng';
      }

      console.log('=== RAG SEARCH COMPLETED ===');
    }

    // Deduct quota for non-admin users (after successful search)
    if (dbUser.role !== 'admin') {
      await prisma.user.update({
        where: { id: user.id },
        data: { aiSearchQuota: { decrement: 1 } }
      });

      // Add remaining quota to response
      result_data.remainingQuota = dbUser.aiSearchQuota - 1;
    } else {
      result_data.remainingQuota = -1; // Unlimited for admin
    }

    // Save AI search history to database
    try {
      // Enhanced matched question data to include RAG info if available
      const enhancedMatchedQuestion = bestMatch ? {
        id: bestMatch.id,
        question: bestMatch.text,
        options: JSON.parse(bestMatch.options),
        correctAnswerIndex: bestMatch.correctAnswerIdx,
        source: bestMatch.source || '',
        category: bestMatch.category || '',
        knowledgeBaseName: bestMatch.base.name,
        // Include RAG search info in the matched question data
        ragSearchInfo: result_data.ragResult ? {
          answer: result_data.ragResult.answer,
          confidence: result_data.ragResult.confidence,
          sourcesCount: result_data.ragResult.sources?.length || 0,
          searchType: result_data.searchType
        } : null
      } : (result_data.ragResult ? {
        // If no DB match but RAG found something, create a synthetic entry
        id: 'rag-only',
        question: recognizedText,
        options: [],
        correctAnswerIndex: -1,
        source: 'RAG Search',
        category: 'AI Generated',
        knowledgeBaseName: 'RAG Database',
        ragSearchInfo: {
          answer: result_data.ragResult.answer,
          confidence: result_data.ragResult.confidence,
          sourcesCount: result_data.ragResult.sources?.length || 0,
          searchType: result_data.searchType,
          isPrimary: result_data.searchType === 'rag-primary'
        }
      } : null);

      await (prisma as any).aiSearchHistory.create({
        data: {
          userId: user.id,
          // Input data (don't store image to save space - can be optional)
          // imageBase64: image.substring(0, 1000), // Store only first 1000 chars as preview
          knowledgeBaseIds: JSON.stringify(knowledgeBaseIds),
          // AI Response
          recognizedText: recognizedText,
          extractedOptions: extractedData.optionA ? JSON.stringify({
            A: extractedData.optionA,
            B: extractedData.optionB,
            C: extractedData.optionC,
            D: extractedData.optionD
          }) : null,
          matchedQuestionId: bestMatch?.id || null,
          matchedQuestion: enhancedMatchedQuestion ? JSON.stringify(enhancedMatchedQuestion) : null,
          confidence: Math.round(bestScore * 100),
          // Model & Token info
          modelUsed: selectedModel.name,
          modelPriority: selectedModel.priority,
          inputTokens: inputTokens,
          outputTokens: outputTokens,
          totalTokens: totalTokens,
          // Metadata
          responseTime: responseTime,
          success: true
        }
      });
      console.log('[AI Search History] Saved search history for user:', user.id, result_data.searchType);
    } catch (historyError) {
      console.error('[AI Search History] Failed to save history:', historyError);
      // Don't fail the request if history save fails
    }

    res.json(result_data);
  } catch (error: any) {
    console.error('Image search error:', error);

    // Provide more specific error messages
    let errorMessage = 'Failed to process image search';

    if (error.message && error.message.includes('API key')) {
      errorMessage = 'API key không hợp lệ. Vui lòng kiểm tra GEMINI_API_KEY.';
    } else if (error.message && error.message.includes('quota')) {
      errorMessage = 'Đã vượt quá giới hạn API. Vui lòng thử lại sau.';
    } else if (error.message && error.message.includes('network')) {
      errorMessage = 'Lỗi kết nối mạng. Vui lòng kiểm tra internet.';
    } else if (error.message) {
      errorMessage = error.message;
    }

    // Save failed search to history
    try {
      const responseTime = startTime > 0 ? Date.now() - startTime : 0;
      await (prisma as any).aiSearchHistory.create({
        data: {
          userId: user?.id || 0,
          knowledgeBaseIds: JSON.stringify(knowledgeBaseIds),
          modelUsed: selectedModel?.name || 'unknown',
          modelPriority: selectedModel?.priority || 0,
          responseTime: responseTime,
          success: false,
          errorMessage: errorMessage
        }
      });
      console.log('[AI Search History] Saved failed search for user:', user?.id);
    } catch (historyError) {
      console.error('[AI Search History] Failed to save error history:', historyError);
    }

    res.status(500).json({ error: errorMessage });
  }
});

// Premium API - Image Search with RAG Streaming for better UX
app.post('/api/premium/search-by-image-stream', async (req: Request, res: Response) => {
  let startTime = 0;
  let user: any = null;
  let knowledgeBaseIds: any[] = [];
  let selectedModel: any = null;

  try {
    user = req.user as any;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    // Check AI search quota
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { aiSearchQuota: true, role: true }
    });

    if (!dbUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Admin has unlimited quota
    if (dbUser.role !== 'admin' && dbUser.aiSearchQuota <= 0) {
      return res.status(403).json({
        error: 'Bạn đã hết lượt tìm kiếm AI. Vui lòng nạp thêm để tiếp tục sử dụng.',
        quota: 0
      });
    }

    const { image, knowledgeBaseIds: kbIds } = req.body;
    knowledgeBaseIds = kbIds;

    if (!image || !knowledgeBaseIds || !Array.isArray(knowledgeBaseIds)) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Set headers for SSE (Server-Sent Events)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    // Helper to send SSE message
    const sendEvent = (event: string, data: any) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    try {
      // Check if GEMINI_API_KEY is configured
      if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
        sendEvent('error', { message: 'GEMINI_API_KEY chưa được cấu hình' });
        res.end();
        return;
      }

      sendEvent('status', { message: 'Đang phân tích hình ảnh...' });

      // Import Gemini AI (new SDK)
      const { GoogleGenAI } = await import('@google/genai');
      const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

      // Check system settings for model rotation
      const systemSettings = await (prisma as any).systemSettings.findFirst();

      if (systemSettings && !systemSettings.modelRotationEnabled) {
        const defaultModelName = await modelSettingsService.getDefaultModel();
        selectedModel = {
          name: defaultModelName,
          priority: 0,
          rpm: 999,
          rpd: 999,
          tpm: 999999,
          category: 'Default Model'
        };
      } else {
        selectedModel = geminiModelRotation.getNextAvailableModel();
        if (!selectedModel) {
          sendEvent('error', { message: 'Tất cả các model AI đã đạt giới hạn. Vui lòng thử lại sau.' });
          res.end();
          return;
        }
      }

      // Convert base64 to proper format for Gemini
      const imagePart = {
        inlineData: {
          data: image,
          mimeType: 'image/jpeg',
        },
      };

      // Prompt for Gemini to extract question text
      const prompt = `Hãy trích xuất văn bản từ ảnh này và trả về CHÍNH XÁC theo định dạng JSON sau:

{
  "question": "Nội dung câu hỏi (không bao gồm A, B, C, D)",
  "optionA": "Nội dung đáp án A (nếu có)",
  "optionB": "Nội dung đáp án B (nếu có)",
  "optionC": "Nội dung đáp án C (nếu có)",
  "optionD": "Nội dung đáp án D (nếu có)"
}

QUY TẮC:
- Chỉ trả về JSON, KHÔNG thêm markdown code block hay giải thích
- "question" chỉ chứa NỘI DUNG CÂU HỎI, bỏ qua phần đáp án A/B/C/D
- Giữ nguyên dấu câu, chính tả
- Nếu không có đáp án nào, để giá trị rỗng ""
- Không thêm văn bản không có trong ảnh`;

      startTime = Date.now();
      const result = await genAI.models.generateContent({
        model: selectedModel.name,
        contents: [prompt, imagePart],
      });
      const responseTime = Date.now() - startTime;

      let responseText = (result.text || '').trim();

      if (!systemSettings || systemSettings.modelRotationEnabled) {
        geminiModelRotation.recordRequest(selectedModel.name);
      }

      // Get token usage from response
      const usageMetadata = (result as any).usageMetadata || {};
      const inputTokens = usageMetadata.promptTokenCount || 0;
      const outputTokens = usageMetadata.candidatesTokenCount || 0;
      const totalTokens = usageMetadata.totalTokenCount || (inputTokens + outputTokens);

      // Remove markdown code blocks if present
      responseText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

      let extractedData: any;
      try {
        extractedData = JSON.parse(responseText);
      } catch (parseError) {
        extractedData = {
          question: responseText,
          optionA: '',
          optionB: '',
          optionC: '',
          optionD: ''
        };
      }

      const recognizedText = extractedData.question || responseText;

      sendEvent('progress', {
        step: 'extracted',
        data: {
          recognizedText,
          extractedOptions: extractedData.optionA ? {
            A: extractedData.optionA,
            B: extractedData.optionB,
            C: extractedData.optionC,
            D: extractedData.optionD
          } : undefined
        }
      });

      sendEvent('status', { message: 'Đang tìm kiếm trong cơ sở dữ liệu...' });

      // Search for matching question in selected knowledge bases (same logic as before)
      const questions = await prisma.question.findMany({
        where: {
          baseId: {
            in: knowledgeBaseIds
          }
        },
        include: {
          base: {
            select: {
              name: true
            }
          }
        }
      });

      // Enhanced matching logic (same as before)
      const normalizeText = (text: string) => {
        return text.toLowerCase()
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .replace(/đ/g, 'd')
          .replace(/[^a-z0-9\s]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      };

      const recognizedNormalized = normalizeText(recognizedText);
      const extractedOptionsNormalized = {
        A: extractedData.optionA ? normalizeText(extractedData.optionA) : '',
        B: extractedData.optionB ? normalizeText(extractedData.optionB) : '',
        C: extractedData.optionC ? normalizeText(extractedData.optionC) : '',
        D: extractedData.optionD ? normalizeText(extractedData.optionD) : ''
      };

      const extractedOptionsList = Object.values(extractedOptionsNormalized).filter(opt => opt.length > 0);
      const allMatches: Array<{ question: any; score: number; matchType: string }> = [];

      // Same matching logic as non-streaming version
      for (const question of questions) {
        const questionNormalized = normalizeText(question.text);
        const questionOptions = JSON.parse(question.options);
        const questionOptionsNormalized = questionOptions.map((opt: string) => normalizeText(opt));

        let matchScore = 0;
        let matchType = '';
        let questionMatchScore = 0;

        if (questionNormalized === recognizedNormalized) {
          questionMatchScore = 1.0;
        } else if (questionNormalized.includes(recognizedNormalized) || recognizedNormalized.includes(questionNormalized)) {
          questionMatchScore = 0.9;
        } else {
          const recognizedWords = recognizedNormalized.split(' ').filter(w => w.length > 2);
          const questionWords = questionNormalized.split(' ').filter(w => w.length > 2);

          if (recognizedWords.length > 0 && questionWords.length > 0) {
            const matchingWords = recognizedWords.filter(word => questionWords.includes(word));
            questionMatchScore = matchingWords.length / Math.max(recognizedWords.length, questionWords.length);
          }
        }

        let optionsMatchScore = 0;
        let matchedOptionsCount = 0;

        if (extractedOptionsList.length > 0) {
          for (const extractedOption of extractedOptionsList) {
            for (const dbOption of questionOptionsNormalized) {
              if (extractedOption === dbOption) {
                matchedOptionsCount++;
                optionsMatchScore = Math.max(optionsMatchScore, 1.0);
                break;
              } else if (extractedOption.includes(dbOption) || dbOption.includes(extractedOption)) {
                matchedOptionsCount++;
                optionsMatchScore = Math.max(optionsMatchScore, 0.8);
                break;
              }
            }
          }

          if (matchedOptionsCount >= 2) {
            optionsMatchScore += 0.2;
            matchType = 'question+options';
          } else if (matchedOptionsCount >= 1) {
            matchType = 'question+option';
          }
        }

        if (questionMatchScore > 0.4 || optionsMatchScore > 0.6) {
          matchScore = (questionMatchScore * 0.8) + (optionsMatchScore * 0.2);

          if (matchType === '') {
            matchType = questionMatchScore > 0.8 ? 'question-exact' : 'question-partial';
          }

          allMatches.push({ question, score: matchScore, matchType });
        }
      }

      allMatches.sort((a, b) => b.score - a.score);
      const bestMatch = allMatches.length > 0 ? allMatches[0].question : null;
      const bestScore = allMatches.length > 0 ? allMatches[0].score : 0;

      let result_data: any = {
        recognizedText: recognizedText,
        extractedOptions: extractedData.optionA ? {
          A: extractedData.optionA,
          B: extractedData.optionB,
          C: extractedData.optionC,
          D: extractedData.optionD
        } : undefined,
        matchedQuestion: bestMatch ? {
          id: bestMatch.id,
          question: bestMatch.text,
          options: JSON.parse(bestMatch.options),
          correctAnswerIndex: bestMatch.correctAnswerIdx,
          source: bestMatch.source || '',
          category: bestMatch.category || '',
          knowledgeBaseName: bestMatch.base.name
        } : null,
        confidence: Math.round(bestScore * 100),
        modelUsed: selectedModel.name,
        modelPriority: selectedModel.priority,
        searchType: 'database'
      };

      // If database match found with good confidence, use it directly
      if (bestMatch && bestScore >= 0.7) {
        sendEvent('progress', {
          step: 'database_match_found',
          data: result_data
        });
      } else {
        // For low confidence matches, we'll use RAG instead - don't show DB results
        if (bestMatch && bestScore < 0.7) {
          console.log(`[Streaming] DB match found but confidence too low (${Math.round(bestScore * 100)}%), switching to RAG-only mode`);
          result_data.matchedQuestion = null; // Hide low-confidence database match
          result_data.confidence = 0; // Reset confidence for RAG
          result_data.searchType = 'rag-only';
        }

        // Stream RAG search process
        sendEvent('status', { message: 'Đang tìm kiếm trong tài liệu RAG...' });

        try {
          const { ragRouterService } = await import('./services/rag-router.service.js');

          // Check RAG configuration
          const ragConfig = await ragRouterService.getRAGConfig();
          const useFileSearch = ragConfig.method === 'google-file-search';

          console.log(`[Streaming RAG] Using method: ${ragConfig.method}${useFileSearch ? ` (store: ${ragConfig.fileSearchStoreName})` : ''}`);

          if (useFileSearch) {
            // Use File Search via RAG Router
            sendEvent('status', { message: 'Đang tìm kiếm với Google File Search...' });

            const ragQuery = {
              question: `Dựa trên câu hỏi: "${recognizedText}"
                        ${extractedData.optionA ? `\nCác đáp án: A) ${extractedData.optionA}, B) ${extractedData.optionB}, C) ${extractedData.optionC}, D) ${extractedData.optionD}` : ''}`,
              topK: 10
            };

            const ragResponse = await ragRouterService.processQuery(ragQuery);

            result_data.ragResult = {
              answer: ragResponse.answer,
              confidence: ragResponse.confidence,
              sources: ragResponse.sources,
              model: ragResponse.model,
              chunksUsed: ragResponse.sources?.length || 0,
              structured: ragResponse.structured || false,
              method: 'google-file-search'
            };

            result_data.searchType = 'rag-only';
            result_data.matchedQuestion = null;
            result_data.confidence = ragResponse.confidence;

            sendEvent('progress', {
              step: 'file_search_completed',
              data: result_data
            });
          } else {
            // Use Qdrant method (existing code)
            const { geminiRAGService } = await import('./services/gemini-rag.service.js');
            const { qdrantService } = await import('./services/qdrant.service.js');

            const questionEmbedding = await geminiRAGService.generateEmbedding(recognizedText);

            sendEvent('status', { message: 'Đang phân tích các tài liệu liên quan...' });

            const availableCollections = await qdrantService.listCollections();
            const collectionNames = availableCollections.map(c => c.name);

            let ragSearchResults: any[] = [];
            if (collectionNames.length > 1) {
              ragSearchResults = await qdrantService.searchMultipleCollections(
                questionEmbedding,
                collectionNames,
                { topK: 10, minScore: 0.4 }
              );
            } else if (collectionNames.length === 1) {
              ragSearchResults = await qdrantService.search(
                questionEmbedding,
                {
                  topK: 10,
                  minScore: 0.4,
                  collectionName: collectionNames[0]
                }
              );
            }

            if (ragSearchResults.length > 0) {
              sendEvent('status', { message: 'Đang tạo câu trả lời từ AI...' });

              ragSearchResults = qdrantService.rerankResults(ragSearchResults, recognizedText, {
                keywordWeight: 0.1,
                maxPerDocument: 3,
              });

              ragSearchResults = ragSearchResults.slice(0, 8);

              const retrievedChunks = ragSearchResults.map((result) => ({
                chunkId: result.id,
                content: result.payload.content,
                documentId: result.payload.documentId,
                documentName: result.payload.documentName,
                documentNumber: result.payload.documentNumber,
                score: result.score,
                metadata: {
                  documentId: result.payload.documentId,
                  documentNumber: result.payload.documentNumber,
                  documentName: result.payload.documentName,
                  documentType: result.payload.documentType,
                  chapterNumber: result.payload.chapterNumber,
                  chapterTitle: result.payload.chapterTitle,
                  articleNumber: result.payload.articleNumber,
                  articleTitle: result.payload.articleTitle,
                  sectionNumber: result.payload.sectionNumber,
                  chunkType: result.payload.chunkType,
                  chunkIndex: result.payload.chunkIndex,
                },
              }));

              const ragQuery = {
                question: `Dựa trên câu hỏi: "${recognizedText}"
                          ${extractedData.optionA ? `\nCác đáp án: A) ${extractedData.optionA}, B) ${extractedData.optionB}, C) ${extractedData.optionC}, D) ${extractedData.optionD}` : ''}`,
                topK: ragSearchResults.length
              };

              const ragResponse = await geminiRAGService.generateRAGAnswer(ragQuery, retrievedChunks);

              result_data.ragResult = {
                answer: ragResponse.answer,
                confidence: ragResponse.confidence,
                sources: ragResponse.sources,
                model: ragResponse.model,
                chunksUsed: ragSearchResults.length,
                structured: ragResponse.structured || false,
                method: 'qdrant'
              };

              // When RAG search is used, hide database results and only show RAG results
              result_data.searchType = 'rag-only';
              result_data.matchedQuestion = null; // Hide database match to show only RAG results
              result_data.confidence = ragResponse.confidence; // Use RAG confidence

              sendEvent('progress', {
                step: 'rag_search_completed',
                data: result_data
              });
            } else {
              result_data.ragResult = null;
              sendEvent('progress', {
                step: 'no_results_found',
                data: result_data
              });
            }
          }
        } catch (ragError) {
          console.error('[RAG Stream] Search failed:', ragError);
          result_data.ragResult = null;
          result_data.ragError = 'RAG search không khả dụng';

          sendEvent('progress', {
            step: 'rag_search_failed',
            data: result_data
          });
        }
      }

      // Deduct quota for non-admin users
      if (dbUser.role !== 'admin') {
        await prisma.user.update({
          where: { id: user.id },
          data: { aiSearchQuota: { decrement: 1 } }
        });
        result_data.remainingQuota = dbUser.aiSearchQuota - 1;
      } else {
        result_data.remainingQuota = -1;
      }

      // Save history (same enhanced format as non-streaming version)
      try {
        const enhancedMatchedQuestion = bestMatch ? {
          id: bestMatch.id,
          question: bestMatch.text,
          options: JSON.parse(bestMatch.options),
          correctAnswerIndex: bestMatch.correctAnswerIdx,
          source: bestMatch.source || '',
          category: bestMatch.category || '',
          knowledgeBaseName: bestMatch.base.name,
          ragSearchInfo: result_data.ragResult ? {
            answer: result_data.ragResult.answer,
            confidence: result_data.ragResult.confidence,
            sourcesCount: result_data.ragResult.sources?.length || 0,
            searchType: result_data.searchType,
            isPrimary: result_data.searchType === 'rag-primary'
          } : null
        } : (result_data.ragResult ? {
          id: 'rag-only',
          question: recognizedText,
          options: [],
          correctAnswerIndex: -1,
          source: 'RAG Search',
          category: 'AI Generated',
          knowledgeBaseName: 'RAG Database',
          ragSearchInfo: {
            answer: result_data.ragResult.answer,
            confidence: result_data.ragResult.confidence,
            sourcesCount: result_data.ragResult.sources?.length || 0,
            searchType: result_data.searchType,
            isPrimary: result_data.searchType === 'rag-primary'
          }
        } : null);

        await (prisma as any).aiSearchHistory.create({
          data: {
            userId: user.id,
            knowledgeBaseIds: JSON.stringify(knowledgeBaseIds),
            recognizedText: recognizedText,
            extractedOptions: extractedData.optionA ? JSON.stringify({
              A: extractedData.optionA,
              B: extractedData.optionB,
              C: extractedData.optionC,
              D: extractedData.optionD
            }) : null,
            matchedQuestionId: bestMatch?.id || null,
            matchedQuestion: enhancedMatchedQuestion ? JSON.stringify(enhancedMatchedQuestion) : null,
            confidence: Math.round(bestScore * 100),
            modelUsed: selectedModel.name,
            modelPriority: selectedModel.priority,
            inputTokens: inputTokens,
            outputTokens: outputTokens,
            totalTokens: totalTokens,
            responseTime: responseTime,
            success: true
          }
        });
      } catch (historyError) {
        console.error('[AI Search History Stream] Failed to save history:', historyError);
      }

      // Send final result
      sendEvent('complete', result_data);
      res.end();

    } catch (error: any) {
      console.error('[Image Search Stream] Error:', error);
      sendEvent('error', {
        message: error.message || 'Lỗi khi xử lý hình ảnh'
      });
      res.end();
    }

  } catch (error: any) {
    console.error('[Image Search Stream] Request error:', error);
    res.status(500).json({
      error: 'Lỗi khi xử lý yêu cầu'
    });
  }
});

// Promote first user as admin if no admin
(async () => {
  try {
    const admin = await prisma.user.findFirst({ where: { role: 'admin' } as any });
    if (!admin) {
      const first = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });
      if (first && (first as any).role !== 'admin') {
        await prisma.user.update({ where: { id: first.id }, data: { role: 'admin' } as any });
        console.log('Promoted first user to admin:', first.email);
      }
    }
  } catch (e) { console.error('Admin promotion check failed', e); }
})();

// Study Plans API endpoints
app.get('/api/study-plans', async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const studyPlans = await prismaAny.studyPlan.findMany({
      where: { userId: user.id },
      include: {
        questionProgress: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(studyPlans);
  } catch (error) {
    console.error('Error fetching study plans:', error);
    res.status(500).json({ error: 'Failed to fetch study plans' });
  }
});

app.post('/api/study-plans', async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const {
      knowledgeBaseId,
      knowledgeBaseName,
      totalDays,
      minutesPerDay,
      questionsPerDay,
      startDate,
      endDate,
      title
    } = req.body;

    const existingCount = await prismaAny.studyPlan.count({
      where: { userId: user.id, knowledgeBaseId }
    });

    const studyPlan = await prismaAny.studyPlan.create({
      data: {
        userId: user.id,
        knowledgeBaseId,
        knowledgeBaseName,
        title: title || `Lộ trình #${existingCount + 1}`,
        totalDays,
        minutesPerDay,
        questionsPerDay,
        startDate: new Date(startDate),
        endDate: new Date(endDate)
      }
    });

    // Fetch all questions in the knowledge base
    const kbWithQuestions = await prisma.knowledgeBase.findUnique({
      where: { id: knowledgeBaseId },
      include: { questions: true }
    });

    if (kbWithQuestions && kbWithQuestions.questions.length) {
      // Initialize all question progress entries as 'hard'
      await prismaAny.questionProgress.createMany({
        data: kbWithQuestions.questions.map((q: any) => ({
          studyPlanId: studyPlan.id,
          questionId: q.id,
          difficultyLevel: 'hard',
          // lastReviewed left null so they can surface immediately
          reviewCount: 0,
          nextReviewAfter: 0
        }))
      });
    }

    const hydratedPlan = await prismaAny.studyPlan.findUnique({
      where: { id: studyPlan.id },
      include: { questionProgress: true }
    });

    res.json(hydratedPlan);
  } catch (error) {
    console.error('Error creating study plan:', error);
    res.status(500).json({ error: 'Failed to create study plan' });
  }
});

app.put('/api/study-plans/:id', async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;
    const updateData = req.body;

    // Verify ownership
    const existingPlan = await prismaAny.studyPlan.findFirst({
      where: { id, userId: user.id }
    });

    if (!existingPlan) {
      return res.status(404).json({ error: 'Study plan not found' });
    }

    // Remove questionProgress from updateData as it needs special handling
    const { questionProgress, ...cleanUpdateData } = updateData;

    // Handle questionProgress separately if provided
    let updateOperation: any = {
      where: { id },
      data: {
        ...cleanUpdateData,
        completedQuestions: typeof cleanUpdateData.completedQuestions === 'object'
          ? JSON.stringify(cleanUpdateData.completedQuestions)
          : cleanUpdateData.completedQuestions
      },
      include: {
        questionProgress: true
      }
    };

    // If questionProgress is provided and is an empty array, delete all progress
    if (questionProgress !== undefined && Array.isArray(questionProgress) && questionProgress.length === 0) {
      updateOperation.data.questionProgress = {
        deleteMany: {}
      };
    }

    const studyPlan = await prismaAny.studyPlan.update(updateOperation);

    res.json(studyPlan);
  } catch (error) {
    console.error('Error updating study plan:', error);
    res.status(500).json({ error: 'Failed to update study plan' });
  }
});

app.delete('/api/study-plans/:id', async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;

    // Verify ownership
    const existingPlan = await prismaAny.studyPlan.findFirst({
      where: { id, userId: user.id }
    });

    if (!existingPlan) {
      return res.status(404).json({ error: 'Study plan not found' });
    }

    await prismaAny.studyPlan.delete({
      where: { id }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting study plan:', error);
    res.status(500).json({ error: 'Failed to delete study plan' });
  }
});

// Question Progress API endpoints
app.post('/api/study-plans/:id/question-progress', async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { id: studyPlanId } = req.params;
    const { questionId, difficultyLevel } = req.body;

    // Verify study plan ownership
    const studyPlan = await prismaAny.studyPlan.findFirst({
      where: { id: studyPlanId, userId: user.id },
      include: { questionProgress: true }
    });

    if (!studyPlan) {
      return res.status(404).json({ error: 'Study plan not found' });
    }

    // Calculate nextReviewAfter based on difficulty and new questions learned
    let nextReviewAfter = null;
    if (difficultyLevel === 'hard') {
      nextReviewAfter = Math.max(10 - studyPlan.newQuestionsLearned, 0);
    } else if (difficultyLevel === 'medium') {
      nextReviewAfter = Math.max(15 - studyPlan.newQuestionsLearned, 5);
    } else if (difficultyLevel === 'easy') {
      nextReviewAfter = null; // Easy questions don't need regular review
    }

    // Upsert question progress
    const questionProgress = await prismaAny.questionProgress.upsert({
      where: {
        studyPlanId_questionId: {
          studyPlanId,
          questionId
        }
      },
      update: {
        difficultyLevel,
        lastReviewed: new Date(),
        reviewCount: { increment: 1 },
        nextReviewAfter
      },
      create: {
        studyPlanId,
        questionId,
        difficultyLevel,
        lastReviewed: new Date(),
        reviewCount: 1,
        nextReviewAfter
      }
    });

    // Update completed questions and new questions count
    const completedQuestions = JSON.parse(studyPlan.completedQuestions || '[]');
    let updatedCompletedQuestions = completedQuestions;
    let newQuestionsLearned = studyPlan.newQuestionsLearned;

    if (difficultyLevel === 'easy' && !completedQuestions.includes(questionId)) {
      updatedCompletedQuestions = [...completedQuestions, questionId];
    } else if (difficultyLevel !== 'easy') {
      updatedCompletedQuestions = completedQuestions.filter((id: string) => id !== questionId);
    }

    // Check if this is a new question (first time rating)
    const existingProgress = studyPlan.questionProgress.find((p: any) => p.questionId === questionId);
    if (!existingProgress || existingProgress.difficultyLevel === null) {
      newQuestionsLearned += 1;
    }

    // Update study plan
    const updatedStudyPlan = await prismaAny.studyPlan.update({
      where: { id: studyPlanId },
      data: {
        completedQuestions: JSON.stringify(updatedCompletedQuestions),
        newQuestionsLearned,
        currentPhase: updatedCompletedQuestions.length === studyPlan.questionProgress.length + 1
          ? 'review'
          : 'initial'
      },
      include: {
        questionProgress: true
      }
    });

    res.json({
      questionProgress,
      studyPlan: updatedStudyPlan
    });
  } catch (error) {
    console.error('Error updating question progress:', error);
    res.status(500).json({ error: 'Failed to update question progress' });
  }
});

app.get('/api/study-plans/:id/today-questions', async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { id: studyPlanId } = req.params;
    const maxQuestions = parseInt(req.query.maxQuestions as string) || 10;

    // Get study plan with progress
    const studyPlan = await prismaAny.studyPlan.findFirst({
      where: { id: studyPlanId, userId: user.id },
      include: { questionProgress: true }
    });

    if (!studyPlan) {
      return res.status(404).json({ error: 'Study plan not found' });
    }

    // Get knowledge base questions
    const knowledgeBase = await prisma.knowledgeBase.findUnique({
      where: { id: studyPlan.knowledgeBaseId },
      include: { questions: true }
    });

    if (!knowledgeBase) {
      return res.status(404).json({ error: 'Knowledge base not found' });
    }

    const allQuestions = knowledgeBase.questions;
    const studiedQuestionIds = new Set(studyPlan.questionProgress.map((p: any) => p.questionId));

    // Get questions that need review (hard and medium questions ready for review)
    const questionsNeedingReview = studyPlan.questionProgress.filter((progress: any) => {
      if (progress.difficultyLevel === 'easy') return false;
      if (progress.nextReviewAfter === null || progress.nextReviewAfter === undefined) return false;
      return studyPlan.newQuestionsLearned >= progress.nextReviewAfter;
    });

    // Get new questions (not yet studied)
    const newQuestions = allQuestions.filter(q => !studiedQuestionIds.has(q.id));

    // Build today's question list
    let todayQuestionIds: string[] = [];

    // Add hard questions first (highest priority)
    const hardQuestions = questionsNeedingReview
      .filter((p: any) => p.difficultyLevel === 'hard')
      .sort((a: any, b: any) => new Date(a.lastReviewed || 0).getTime() - new Date(b.lastReviewed || 0).getTime())
      .slice(0, maxQuestions);
    todayQuestionIds.push(...hardQuestions.map((p: any) => p.questionId));

    // Add medium questions if there's space
    const remainingSlots = maxQuestions - todayQuestionIds.length;
    if (remainingSlots > 0) {
      const mediumQuestions = questionsNeedingReview
        .filter((p: any) => p.difficultyLevel === 'medium')
        .sort((a: any, b: any) => new Date(a.lastReviewed || 0).getTime() - new Date(b.lastReviewed || 0).getTime())
        .slice(0, remainingSlots);
      todayQuestionIds.push(...mediumQuestions.map((p: any) => p.questionId));
    }

    // Fill remaining slots with new questions
    const stillRemainingSlots = maxQuestions - todayQuestionIds.length;
    if (stillRemainingSlots > 0) {
      const newQuestionIds = newQuestions.slice(0, stillRemainingSlots).map(q => q.id);
      todayQuestionIds.push(...newQuestionIds);
    }

    // Get full question objects
    const todayQuestions = allQuestions.filter(q => todayQuestionIds.includes(q.id));

    res.json({
      questions: todayQuestions.map(q => ({
        id: q.id,
        question: q.text,
        options: JSON.parse(q.options),
        correctAnswerIndex: q.correctAnswerIdx,
        source: q.source,
        category: q.category
      })),
      studyPlan
    });
  } catch (error) {
    console.error('Error getting today questions:', error);
    res.status(500).json({ error: 'Failed to get today questions' });
  }
});

// Get all hard questions for intensive study
app.get('/api/study-plans/:id/all-hard-questions', async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { id: studyPlanId } = req.params;

    // Get study plan with progress
    const studyPlan = await prismaAny.studyPlan.findFirst({
      where: { id: studyPlanId, userId: user.id },
      include: { questionProgress: true }
    });

    if (!studyPlan) {
      return res.status(404).json({ error: 'Study plan not found' });
    }

    // Get knowledge base questions
    const knowledgeBase = await prisma.knowledgeBase.findUnique({
      where: { id: studyPlan.knowledgeBaseId },
      include: { questions: true }
    });

    if (!knowledgeBase) {
      return res.status(404).json({ error: 'Knowledge base not found' });
    }

    const allQuestions = knowledgeBase.questions;
    const studiedQuestionIds = new Set(studyPlan.questionProgress.map((p: any) => p.questionId));

    // Get hard questions that need review (with last reviewed info)
    const hardProgressItems = studyPlan.questionProgress
      .filter((progress: any) => progress.difficultyLevel === 'hard')
      .sort((a: any, b: any) => {
        // Sort by last reviewed date (oldest first), then by created date
        const dateA = a.lastReviewed ? new Date(a.lastReviewed).getTime() : new Date(a.createdAt).getTime();
        const dateB = b.lastReviewed ? new Date(b.lastReviewed).getTime() : new Date(b.createdAt).getTime();
        return dateA - dateB;
      });

    // Get medium questions for occasional review (less frequent)
    const mediumProgressItems = studyPlan.questionProgress
      .filter((progress: any) => progress.difficultyLevel === 'medium')
      .filter(() => Math.random() < 0.25) // Only 25% chance to include medium questions
      .sort((a: any, b: any) => {
        const dateA = a.lastReviewed ? new Date(a.lastReviewed).getTime() : new Date(a.createdAt).getTime();
        const dateB = b.lastReviewed ? new Date(b.lastReviewed).getTime() : new Date(b.createdAt).getTime();
        return dateA - dateB;
      });

    // Get new questions (not yet studied) 
    const newQuestions = allQuestions.filter(q => !studiedQuestionIds.has(q.id));

    // Debug logging
    console.log('Debug getAllHardQuestions:');
    console.log('- Total questions:', allQuestions.length);
    console.log('- Studied questions:', studiedQuestionIds.size);
    console.log('- Hard questions:', hardProgressItems.length);
    console.log('- Medium questions:', mediumProgressItems.length);
    console.log('- New questions:', newQuestions.length);
    console.log('- Question progress:', studyPlan.questionProgress.length);

    // Combine hard questions + some new questions with smart spacing
    const hardQuestionObjects = allQuestions.filter(q =>
      hardProgressItems.some((p: any) => p.questionId === q.id)
    );
    const mediumQuestionObjects = allQuestions.filter(q =>
      mediumProgressItems.some((p: any) => p.questionId === q.id)
    );

    // Add reviewed hard questions with "isReviewed" flag and last reviewed info
    const reviewedHardQuestions = hardQuestionObjects.map(q => {
      const progress = hardProgressItems.find((p: any) => p.questionId === q.id);
      return {
        id: q.id,
        question: q.text,
        options: JSON.parse(q.options),
        correctAnswerIndex: q.correctAnswerIdx,
        source: q.source,
        category: q.category,
        isReviewed: progress?.lastReviewed ? true : false, // Only if actually reviewed
        lastReviewed: progress?.lastReviewed,
        reviewCount: progress?.reviewCount || 0,
        daysSinceLastReview: progress?.lastReviewed
          ? Math.floor((new Date().getTime() - new Date(progress.lastReviewed).getTime()) / (1000 * 60 * 60 * 24))
          : null
      };
    });

    // Add some medium questions occasionally (25% chance for each)
    const reviewedMediumQuestions = mediumQuestionObjects.map(q => {
      const progress = mediumProgressItems.find((p: any) => p.questionId === q.id);
      return {
        id: q.id,
        question: q.text,
        options: JSON.parse(q.options),
        correctAnswerIndex: q.correctAnswerIdx,
        source: q.source,
        category: q.category,
        isReviewed: progress?.lastReviewed ? true : false, // Only if actually reviewed
        lastReviewed: progress?.lastReviewed,
        reviewCount: progress?.reviewCount || 0,
        daysSinceLastReview: progress?.lastReviewed
          ? Math.floor((new Date().getTime() - new Date(progress.lastReviewed).getTime()) / (1000 * 60 * 60 * 24))
          : null
      };
    });

    // Combine all reviewed questions
    const allReviewedQuestions = [...reviewedHardQuestions, ...reviewedMediumQuestions];

    // Add new questions without isReviewed flag  
    const newQuestionObjects = newQuestions.slice(0, 20).map(q => ({
      id: q.id,
      question: q.text,
      options: JSON.parse(q.options),
      correctAnswerIndex: q.correctAnswerIdx,
      source: q.source,
      category: q.category,
      isReviewed: false
    }));

    console.log('- Hard questions prepared:', reviewedHardQuestions.length);
    console.log('- Medium questions prepared:', reviewedMediumQuestions.length);
    console.log('- New questions prepared:', newQuestionObjects.length);
    console.log('- Sample hard question isReviewed:', reviewedHardQuestions[0]?.isReviewed, 'lastReviewed:', reviewedHardQuestions[0]?.lastReviewed);

    // Smart mixing: insert reviewed questions every 5-10 new questions
    let mixedQuestions: any[] = [];
    let reviewedIndex = 0;
    let newIndex = 0;
    let questionCount = 0;

    // If no new questions, just return reviewed questions
    if (newQuestionObjects.length === 0) {
      mixedQuestions = allReviewedQuestions.slice(0, 50); // Limit to 50 questions
    } else {
      // Mix new and reviewed questions
      while (newIndex < newQuestionObjects.length || reviewedIndex < allReviewedQuestions.length) {
        // Add 5-10 new questions
        const batchSize = Math.floor(Math.random() * 6) + 5; // 5-10
        for (let i = 0; i < batchSize && newIndex < newQuestionObjects.length; i++) {
          mixedQuestions.push(newQuestionObjects[newIndex++]);
          questionCount++;
        }

        // Add a reviewed question if available
        if (reviewedIndex < allReviewedQuestions.length) {
          mixedQuestions.push(allReviewedQuestions[reviewedIndex++]);
          questionCount++;
        }

        // Limit total questions
        if (mixedQuestions.length >= 50) break;
      }
    }

    res.json({
      questions: mixedQuestions,
      studyPlan
    });
  } catch (error) {
    console.error('Error getting all hard questions:', error);
    res.status(500).json({ error: 'Failed to get all hard questions' });
  }
});

// Debug endpoint to check question progress status
app.get('/api/study-plans/:id/debug-progress', async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { id: studyPlanId } = req.params;

    const studyPlan = await prismaAny.studyPlan.findFirst({
      where: { id: studyPlanId, userId: user.id },
      include: { questionProgress: true }
    });

    if (!studyPlan) {
      return res.status(404).json({ error: 'Study plan not found' });
    }

    const knowledgeBase = await prisma.knowledgeBase.findUnique({
      where: { id: studyPlan.knowledgeBaseId },
      include: { questions: true }
    });

    const progressByDifficulty = studyPlan.questionProgress.reduce((acc: any, progress: any) => {
      acc[progress.difficultyLevel] = (acc[progress.difficultyLevel] || 0) + 1;
      return acc;
    }, {});

    res.json({
      studyPlan: {
        id: studyPlan.id,
        name: studyPlan.name,
        totalQuestions: knowledgeBase?.questions.length || 0,
        studiedQuestions: studyPlan.questionProgress.length,
        progressByDifficulty,
        progressDetails: studyPlan.questionProgress.map((p: any) => ({
          questionId: p.questionId,
          difficultyLevel: p.difficultyLevel,
          updatedAt: p.updatedAt
        }))
      }
    });
  } catch (error) {
    console.error('Error getting debug progress:', error);
    res.status(500).json({ error: 'Failed to get debug progress' });
  }
});

// Smart review system - load all questions with intelligent ordering
app.get('/api/study-plans/:id/smart-review', async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { id: studyPlanId } = req.params;

    // Get study plan with progress
    const studyPlan = await prismaAny.studyPlan.findFirst({
      where: { id: studyPlanId, userId: user.id },
      include: { questionProgress: true }
    });

    if (!studyPlan) {
      return res.status(404).json({ error: 'Study plan not found' });
    }

    // Get knowledge base questions
    const knowledgeBase = await prisma.knowledgeBase.findUnique({
      where: { id: studyPlan.knowledgeBaseId },
      include: { questions: true }
    });

    if (!knowledgeBase) {
      return res.status(404).json({ error: 'Knowledge base not found' });
    }

    const allQuestions = knowledgeBase.questions;
    const progressMap = new Map(
      studyPlan.questionProgress.map((p: any) => [p.questionId, p])
    );

    // Categorize questions by their current status
    const newQuestions = [];
    const hardQuestions = [];
    const mediumQuestions = [];
    const easyQuestions = [];

    for (const question of allQuestions) {
      const progress = progressMap.get(question.id) as any;
      const questionObj = {
        id: question.id,
        question: question.text,
        options: JSON.parse(question.options),
        correctAnswerIndex: question.correctAnswerIdx,
        source: question.source,
        category: question.category,
        isReviewed: progress?.lastReviewed ? true : false,
        lastReviewed: progress?.lastReviewed,
        reviewCount: progress?.reviewCount || 0,
        difficultyLevel: progress?.difficultyLevel || null,
        daysSinceLastReview: progress?.lastReviewed
          ? Math.floor((new Date().getTime() - new Date(progress.lastReviewed).getTime()) / (1000 * 60 * 60 * 24))
          : null
      };

      if (!progress) {
        newQuestions.push(questionObj);
      } else {
        switch (progress.difficultyLevel) {
          case 'hard':
            hardQuestions.push(questionObj);
            break;
          case 'medium':
            mediumQuestions.push(questionObj);
            break;
          case 'easy':
            easyQuestions.push(questionObj);
            break;
          default:
            newQuestions.push(questionObj);
        }
      }
    }

    // Sort questions by priority
    // New questions: random order
    newQuestions.sort(() => Math.random() - 0.5);

    // Hard questions: oldest reviewed first
    hardQuestions.sort((a, b) => {
      const dateA = a.lastReviewed ? new Date(a.lastReviewed).getTime() : 0;
      const dateB = b.lastReviewed ? new Date(b.lastReviewed).getTime() : 0;
      return dateA - dateB;
    });

    // Medium questions: oldest reviewed first  
    mediumQuestions.sort((a, b) => {
      const dateA = a.lastReviewed ? new Date(a.lastReviewed).getTime() : 0;
      const dateB = b.lastReviewed ? new Date(b.lastReviewed).getTime() : 0;
      return dateA - dateB;
    });

    console.log('Smart Review Stats:');
    console.log('- New questions:', newQuestions.length);
    console.log('- Hard questions:', hardQuestions.length);
    console.log('- Medium questions:', mediumQuestions.length);
    console.log('- Easy questions:', easyQuestions.length);

    res.json({
      questions: {
        new: newQuestions,
        hard: hardQuestions,
        medium: mediumQuestions,
        easy: easyQuestions
      },
      stats: {
        total: allQuestions.length,
        new: newQuestions.length,
        hard: hardQuestions.length,
        medium: mediumQuestions.length,
        easy: easyQuestions.length
      },
      studyPlan
    });
  } catch (error) {
    console.error('Error getting smart review:', error);
    res.status(500).json({ error: 'Failed to get smart review questions' });
  }
});

// Reset study plan progress (for testing purposes)
app.post('/api/study-plans/:id/reset-progress', async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { id: studyPlanId } = req.params;

    // Verify ownership
    const studyPlan = await prismaAny.studyPlan.findFirst({
      where: { id: studyPlanId, userId: user.id }
    });

    if (!studyPlan) {
      return res.status(404).json({ error: 'Study plan not found' });
    }

    // Delete all progress
    await prismaAny.questionProgress.deleteMany({
      where: { studyPlanId: studyPlanId }
    });

    res.json({ message: 'Progress reset successfully' });
  } catch (error) {
    console.error('Error resetting progress:', error);
    res.status(500).json({ error: 'Failed to reset progress' });
  }
});

// ==================== PayOS Payment Integration ====================

// Test endpoint
app.get('/api/premium/test-payos', async (req: Request, res: Response) => {
  try {
    const clientId = process.env.PAYOS_CLIENT_ID;
    const apiKey = process.env.PAYOS_API_KEY;
    const checksumKey = process.env.PAYOS_CHECKSUM_KEY;

    res.json({
      configured: !!(clientId && apiKey && checksumKey),
      clientId: clientId ? clientId.slice(0, 8) + '...' : 'not set',
      hasApiKey: !!apiKey,
      hasChecksumKey: !!checksumKey
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create payment link with QR code
app.post('/api/premium/create-payment-link', async (req: Request, res: Response) => {
  try {
    console.log('[PayOS] Received payment link request');
    console.log('[PayOS] Request body:', JSON.stringify(req.body));

    const user = req.user as any;
    if (!user) {
      console.log('[PayOS] User not authenticated');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log('[PayOS] User:', user.id, user.username);
    const { planId } = req.body;
    console.log('[PayOS] Plan ID:', planId);

    if (!planId) {
      console.log('[PayOS] Missing plan ID');
      return res.status(400).json({ error: 'Missing plan ID' });
    }

    // Fetch plan from database
    const dbPlan = await prismaAny.subscriptionPlan.findUnique({
      where: { planId: planId }
    });

    if (!dbPlan || !dbPlan.isActive) {
      console.log('[PayOS] Plan not found or not active:', planId);
      return res.status(400).json({ error: 'Invalid or inactive plan' });
    }

    console.log('[PayOS] Found plan:', dbPlan.name, dbPlan.price);

    // Check PayOS configuration
    const clientId = process.env.PAYOS_CLIENT_ID;
    const apiKey = process.env.PAYOS_API_KEY;
    const checksumKey = process.env.PAYOS_CHECKSUM_KEY;

    if (!clientId || !apiKey || !checksumKey ||
      clientId === 'your_client_id_here' ||
      apiKey === 'your_api_key_here' ||
      checksumKey === 'your_checksum_key_here') {
      return res.status(500).json({
        error: 'PayOS chưa được cấu hình. Vui lòng thêm PAYOS_CLIENT_ID, PAYOS_API_KEY, và PAYOS_CHECKSUM_KEY vào file .env'
      });
    }

    // Check if user already has a pending subscription for this plan
    const existingSubscription = await prismaAny.subscription.findFirst({
      where: {
        userId: user.id,
        plan: planId,
        status: 'pending'
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // If existing pending subscription found, check if PayOS link is still valid
    if (existingSubscription && existingSubscription.transactionCode) {
      console.log('[PayOS] Found existing pending subscription:', existingSubscription.id);

      // Check if subscription has complete payment info (qrCode, checkoutUrl, accountNumber)
      const hasCompleteInfo = existingSubscription.qrCode &&
        existingSubscription.checkoutUrl &&
        existingSubscription.accountNumber;

      if (!hasCompleteInfo) {
        console.log('[PayOS] Existing subscription missing payment info, creating new one');
        await prismaAny.subscription.update({
          where: { id: existingSubscription.id },
          data: { status: 'cancelled' }
        });
      } else {
        // Has complete info, verify with PayOS
        const { PayOS } = await import('@payos/node');
        const payOS = new PayOS({ clientId, apiKey, checksumKey });

        try {
          // Check payment status from PayOS
          const paymentInfo = await payOS.paymentRequests.get(parseInt(existingSubscription.transactionCode));

          console.log('[PayOS] Existing payment status:', paymentInfo.status);

          // If payment is still pending or processing, return existing link
          if (paymentInfo.status === 'PENDING' || paymentInfo.status === 'PROCESSING') {
            console.log('[PayOS] Reusing existing payment link with complete info');

            return res.json({
              success: true,
              orderCode: parseInt(existingSubscription.transactionCode),
              amount: existingSubscription.price,
              description: existingSubscription.description || existingSubscription.transactionCode,
              qrCode: existingSubscription.qrCode,
              checkoutUrl: existingSubscription.checkoutUrl,
              paymentLinkId: existingSubscription.paymentLinkId || '',
              accountNumber: existingSubscription.accountNumber,
              accountName: existingSubscription.accountName || '',
              bin: existingSubscription.bin || '',
              isExisting: true // Flag to indicate this is an existing link
            });
          } else {
            // Payment is cancelled or expired, mark as cancelled and create new one
            console.log('[PayOS] Old payment link expired/cancelled, creating new one');
            await prismaAny.subscription.update({
              where: { id: existingSubscription.id },
              data: { status: 'cancelled' }
            });
          }
        } catch (error: any) {
          // If PayOS API fails (404 or other), assume link expired, create new one
          console.log('[PayOS] Error checking existing payment, creating new one:', error.message);
          await prismaAny.subscription.update({
            where: { id: existingSubscription.id },
            data: { status: 'cancelled' }
          });
        }
      }
    }

    // Use plan from database
    const plan = {
      name: dbPlan.name,
      price: dbPlan.price,
      aiQuota: dbPlan.aiQuota,
      duration: dbPlan.duration
    };

    // Import PayOS SDK
    const { PayOS } = await import('@payos/node');
    const payOS = new PayOS({
      clientId,
      apiKey,
      checksumKey
    });

    // Generate unique order code (timestamp + random)
    const orderCode = parseInt(`${Date.now()}${Math.floor(Math.random() * 1000)}`);

    // Get user info
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { username: true, email: true }
    });

    // Description tối đa 25 ký tự cho PayOS
    // Format: PLAN-timestamp6digit (ví dụ: PLUS-123456, PREMIUM-123456)
    const shortDescription = `${planId.toUpperCase()}-${Date.now().toString().slice(-6)}`;

    // Create payment link
    const paymentData = {
      orderCode: orderCode,
      amount: plan.price,
      description: shortDescription,
      cancelUrl: `${appBaseUrl}/premium/cancel`,
      returnUrl: `${appBaseUrl}/premium/success`,
      buyerName: dbUser?.username || user.username || 'User',
      buyerEmail: dbUser?.email || user.email || undefined,
    };

    console.log('Creating PayOS payment link:', paymentData);

    // Call PayOS API v2
    const paymentResponse = await payOS.paymentRequests.create({
      orderCode: paymentData.orderCode,
      amount: paymentData.amount,
      description: paymentData.description,
      cancelUrl: paymentData.cancelUrl,
      returnUrl: paymentData.returnUrl,
      buyerName: paymentData.buyerName,
      buyerEmail: paymentData.buyerEmail,
    });

    console.log('PayOS Response:', paymentResponse);

    // Convert QR code text to base64 image
    let qrCodeBase64 = '';
    if (paymentResponse.qrCode) {
      const QRCode = (await import('qrcode')).default;
      // Generate QR code as data URL (base64)
      const qrDataURL = await QRCode.toDataURL(paymentResponse.qrCode, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        width: 512,
        margin: 2
      });
      // Extract base64 part (remove "data:image/png;base64," prefix)
      qrCodeBase64 = qrDataURL.replace(/^data:image\/png;base64,/, '');
    }

    // Lưu subscription record với đầy đủ thông tin PayOS link
    await prismaAny.subscription.create({
      data: {
        userId: user.id,
        plan: planId,
        price: plan.price,
        aiQuota: plan.aiQuota,
        duration: plan.duration,
        status: 'pending',
        paymentMethod: 'payos',
        transactionCode: orderCode.toString(),
        description: shortDescription,
        qrCode: qrCodeBase64,
        checkoutUrl: paymentResponse.checkoutUrl,
        paymentLinkId: paymentResponse.paymentLinkId,
        accountNumber: paymentResponse.accountNumber,
        accountName: paymentResponse.accountName,
        bin: paymentResponse.bin,
      }
    });

    // Return payment info with QR code
    res.json({
      success: true,
      orderCode: orderCode,
      amount: plan.price,
      description: shortDescription,
      qrCode: qrCodeBase64, // Base64 QR code image
      checkoutUrl: paymentResponse.checkoutUrl,
      paymentLinkId: paymentResponse.paymentLinkId,
      accountNumber: paymentResponse.accountNumber,
      accountName: paymentResponse.accountName,
      bin: paymentResponse.bin,
    });

  } catch (error: any) {
    console.error('Error creating payment link:', error);
    res.status(500).json({
      error: 'Không thể tạo link thanh toán',
      details: error.message
    });
  }
});

// Get pending payment for current user
app.get('/api/premium/pending-payment', async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    // Find the most recent pending subscription
    const pendingSubscription = await prismaAny.subscription.findFirst({
      where: {
        userId: user.id,
        status: 'pending'
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (!pendingSubscription) {
      return res.json({ hasPending: false });
    }

    // Check if PayOS link is still valid
    const clientId = process.env.PAYOS_CLIENT_ID;
    const apiKey = process.env.PAYOS_API_KEY;
    const checksumKey = process.env.PAYOS_CHECKSUM_KEY;

    if (!clientId || !apiKey || !checksumKey) {
      return res.json({ hasPending: false });
    }

    try {
      const { PayOS } = await import('@payos/node');
      const payOS = new PayOS({ clientId, apiKey, checksumKey });

      const paymentInfo = await payOS.paymentRequests.get(parseInt(pendingSubscription.transactionCode));

      // If payment is still pending, return the subscription info
      if (paymentInfo.status === 'PENDING' || paymentInfo.status === 'PROCESSING') {
        return res.json({
          hasPending: true,
          planId: pendingSubscription.plan,
          orderCode: parseInt(pendingSubscription.transactionCode),
          amount: pendingSubscription.price,
          description: pendingSubscription.description,
          qrCode: pendingSubscription.qrCode,
          checkoutUrl: pendingSubscription.checkoutUrl,
          paymentLinkId: pendingSubscription.paymentLinkId,
          accountNumber: pendingSubscription.accountNumber,
          accountName: pendingSubscription.accountName,
          bin: pendingSubscription.bin,
          createdAt: pendingSubscription.createdAt
        });
      } else {
        // Payment expired or cancelled, mark as cancelled
        await prismaAny.subscription.update({
          where: { id: pendingSubscription.id },
          data: { status: 'cancelled' }
        });
        return res.json({ hasPending: false });
      }
    } catch (error) {
      // PayOS API error, assume link expired
      await prismaAny.subscription.update({
        where: { id: pendingSubscription.id },
        data: { status: 'cancelled' }
      });
      return res.json({ hasPending: false });
    }

  } catch (error: any) {
    console.error('Error checking pending payment:', error);
    res.status(500).json({ error: error.message });
  }
});

// Check payment status
app.get('/api/premium/payment-status/:orderCode', async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { orderCode } = req.params;

    // Check with PayOS first to get real-time status
    const clientId = process.env.PAYOS_CLIENT_ID;
    const apiKey = process.env.PAYOS_API_KEY;
    const checksumKey = process.env.PAYOS_CHECKSUM_KEY;

    if (!clientId || !apiKey || !checksumKey) {
      return res.status(500).json({ error: 'PayOS not configured' });
    }

    try {
      const { PayOS } = await import('@payos/node');
      const payOS = new PayOS({ clientId, apiKey, checksumKey });

      // Get payment info from PayOS
      const paymentInfo = await payOS.paymentRequests.get(parseInt(orderCode));

      console.log('[PayOS] Payment status from PayOS:', paymentInfo.status);

      // If payment is PAID, check if we've already activated the user
      if (paymentInfo.status === 'PAID') {
        const subscription = await prismaAny.subscription.findUnique({
          where: { transactionCode: orderCode },
        });

        if (subscription && subscription.status === 'active') {
          // Already activated
          return res.json({
            success: true,
            status: 'active',
            paid: true,
            amount: subscription.price,
            activatedAt: subscription.activatedAt,
            expiresAt: subscription.expiresAt
          });
        } else if (subscription && subscription.status === 'pending') {
          // Payment confirmed by PayOS but not yet activated by webhook
          // This shouldn't happen if webhook is working, but handle it
          console.log('[PayOS] Payment PAID but subscription still pending - webhook may have failed');
          return res.json({
            success: true,
            status: 'PAID',
            paid: true,
            amount: paymentInfo.amount,
            amountPaid: paymentInfo.amountPaid,
            transactions: paymentInfo.transactions || [],
            note: 'Payment confirmed, waiting for system activation'
          });
        }
      }

      // Return PayOS status
      return res.json({
        success: true,
        status: paymentInfo.status, // PENDING, PAID, CANCELLED, PROCESSING
        paid: paymentInfo.status === 'PAID',
        amount: paymentInfo.amount,
        amountPaid: paymentInfo.amountPaid,
        transactions: paymentInfo.transactions || [],
      });

    } catch (payosError: any) {
      console.error('[PayOS] Error checking with PayOS:', payosError.message);

      // If PayOS fails, fall back to database
      const subscription = await prismaAny.subscription.findUnique({
        where: { transactionCode: orderCode },
      });

      if (subscription) {
        return res.json({
          success: true,
          status: subscription.status,
          paid: subscription.status === 'active',
          amount: subscription.price,
          activatedAt: subscription.activatedAt,
          expiresAt: subscription.expiresAt,
          note: 'Status from database (PayOS unavailable)'
        });
      }

      throw payosError;
    }

  } catch (error: any) {
    console.error('Error checking payment status:', error);
    res.status(500).json({
      error: 'Không thể kiểm tra trạng thái thanh toán',
      details: error.message
    });
  }
});

// PayOS Webhook to receive payment confirmation
app.post('/api/premium/payos-webhook', async (req: Request, res: Response) => {
  try {
    const webhookData = req.body;

    console.log('PayOS Webhook received:', webhookData);

    // Verify signature
    const checksumKey = process.env.PAYOS_CHECKSUM_KEY;
    if (!checksumKey) {
      return res.status(500).json({ error: 'Checksum key not configured' });
    }

    const { PayOS } = await import('@payos/node');
    const payOS = new PayOS({
      clientId: process.env.PAYOS_CLIENT_ID || '',
      apiKey: process.env.PAYOS_API_KEY || '',
      checksumKey: checksumKey
    });

    // Verify webhook signature
    const verifiedData = await payOS.webhooks.verify(webhookData);

    console.log('Verified webhook data:', verifiedData);

    // Process payment success
    if (verifiedData) {
      const { orderCode, amount } = verifiedData;

      // Tìm subscription record từ database bằng orderCode
      const subscription = await prismaAny.subscription.findUnique({
        where: { transactionCode: orderCode.toString() },
        include: { user: true }
      });

      if (subscription && subscription.status === 'pending') {
        const userId = subscription.userId;
        const planId = subscription.plan;
        const aiQuota = subscription.aiQuota;
        const duration = subscription.duration;

        // Get plan details from database for better display
        const planDetails = await prismaAny.subscriptionPlan.findUnique({
          where: { planId: planId }
        });

        // Calculate expiry date
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + duration);

        // Only update AI search quota in User table
        await prisma.user.update({
          where: { id: userId },
          data: {
            aiSearchQuota: { increment: aiQuota },
            pendingThankYouPopup: 1 // Set flag to show thank you popup on next homepage visit
          }
        });

        // Update subscription status with expiry date
        await prismaAny.subscription.update({
          where: { id: subscription.id },
          data: {
            status: 'active',
            activatedAt: new Date(),
            expiresAt: expiresAt
          }
        });

        console.log(`✅ Auto-activated ${planId} for user ${userId}, expires at ${expiresAt}`);

        // Emit Socket.IO event to notify client
        const eventData = {
          plan: planId,
          planName: planDetails?.name || planId,
          expiresAt: expiresAt,
          aiQuota: aiQuota,
          duration: duration,
          price: subscription.price
        };

        const room = `user:${userId}`;
        const socketsInRoom = await io.in(room).fetchSockets();
        console.log(`[Socket.IO] Emitting to room: ${room}, sockets in room: ${socketsInRoom.length}`);

        io.to(room).emit('subscription-activated', eventData);
        console.log(`[Socket.IO] Emitted subscription-activated:`, eventData);

        // Send Telegram notification
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        const chatId = process.env.TELEGRAM_CHAT_ID;
        if (botToken && chatId) {
          const TelegramBot = (await import('node-telegram-bot-api')).default;
          const bot = new TelegramBot(botToken);
          const username = subscription.user?.username || userId;
          const message = `✅ *Thanh toán thành công*\n\n` +
            `👤 User: ${username}\n` +
            `📦 Gói: ${planId.toUpperCase()}\n` +
            `💰 Số tiền: ${amount.toLocaleString()}đ\n` +
            `🔍 AI Search: +${aiQuota}\n` +
            `⏰ Hết hạn: ${expiresAt.toLocaleDateString('vi-VN')}\n` +
            `🔖 Mã đơn: ${orderCode}\n\n` +
            `_Đã tự động kích hoạt_`;
          await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        }
      } else {
        console.log('Subscription not found or already processed:', orderCode);
      }
    }

    // Always return success to PayOS
    res.status(200).json({ success: true });

  } catch (error: any) {
    console.error('Error processing PayOS webhook:', error);
    // Still return 200 to prevent PayOS from retrying
    res.status(200).json({ success: true });
  }
});

// Check subscription status for current user (for auto-refresh after payment)
app.get('/api/premium/check-subscription', async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    // Get active subscription
    const activeSubscription = await getActiveSubscription(user.id);

    if (activeSubscription) {
      return res.json({
        hasActiveSubscription: true,
        plan: activeSubscription.plan,
        expiresAt: activeSubscription.expiresAt,
        activatedAt: activeSubscription.activatedAt
      });
    }

    // Check for pending subscription
    const pendingSubscription = await prismaAny.subscription.findFirst({
      where: {
        userId: user.id,
        status: 'pending'
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json({
      hasActiveSubscription: false,
      hasPendingSubscription: !!pendingSubscription
    });

  } catch (error: any) {
    console.error('Error checking subscription:', error);
    res.status(500).json({ error: error.message });
  }
});

// Check and reset thank you popup flag
app.get('/api/premium/check-thank-you-popup', async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    // Get current user's pendingThankYouPopup value
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { pendingThankYouPopup: true }
    });

    const shouldShow = (dbUser?.pendingThankYouPopup || 0) > 0;

    // If popup should be shown, reset the flag to 0
    if (shouldShow) {
      await prisma.user.update({
        where: { id: user.id },
        data: { pendingThankYouPopup: 0 }
      });
    }

    res.json({
      shouldShow: shouldShow
    });

  } catch (error: any) {
    console.error('Error checking thank you popup:', error);
    res.status(500).json({ error: error.message });
  }
});