import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import passport from 'passport';
import session from 'express-session';
import { Strategy as GoogleStrategy, Profile } from 'passport-google-oauth20';
import { Strategy as LocalStrategy } from 'passport-local';
import bcrypt from 'bcrypt';
import { PrismaClient, User } from '@prisma/client';

const prisma = new PrismaClient();
// Temporary any-cast for newly added models if type generation not up-to-date
const prismaAny = prisma as any;
const app = express();
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
app.get('/api/auth/google/callback', passport.authenticate('google', { failureRedirect: '/api/auth/fail' }), (req: Request, res: Response) => {
  // If APP_BASE_URL provided, always trust it. Otherwise derive from forwarded headers (production behind Nginx)
  let finalBase = appBaseUrl;
  if (!process.env.APP_BASE_URL) {
    const host = (req.headers['x-forwarded-host'] as string) || req.headers.host;
    if (host) {
      const proto = (req.headers['x-forwarded-proto'] as string) || (req.secure ? 'https' : 'http');
      finalBase = `${proto}://${host.replace(/\/$/, '')}`;
    }
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

app.post('/api/auth/login', passport.authenticate('local'), (req: Request, res: Response) => {
  // If this function gets called, authentication was successful.
  // `req.user` contains the authenticated user.
  res.json({ user: req.user });
});

app.get('/api/auth/logout', (req: Request, res: Response) => {
  req.logout(err => {
    if (err) console.error(err);
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      res.json({ ok: true });
    });
  });
});

app.get('/api/auth/me', (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ user: null });
  res.json({ user: req.user });
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
    const { knowledgeBaseIds } = req.body;

    if (!knowledgeBaseIds || !Array.isArray(knowledgeBaseIds) || knowledgeBaseIds.length === 0) {
      return res.status(400).json({ error: 'Invalid knowledge base IDs' });
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

    res.json(result);
  } catch (error) {
    console.error('Failed to fetch questions for quick search:', error);
    res.status(500).json({ error: 'Failed to fetch questions' });
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
  const users = await prisma.user.findMany();
  res.json(users);
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


const port = parseInt(process.env.PORT || '3000', 10);
app.listen(port, () => console.log('API server on :' + port));
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