import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import passport from 'passport';
import session from 'express-session';
import { Strategy as GoogleStrategy, Profile } from 'passport-google-oauth20';
import { PrismaClient, User } from '@prisma/client';

const prisma = new PrismaClient();
const app = express();
const bodyLimit = process.env.MAX_BODY_SIZE || '5mb';

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: bodyLimit }));
app.use(express.urlencoded({ extended: true, limit: bodyLimit }));
app.use(session({ secret: 'dev-secret', resave: false, saveUninitialized: false }));
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user: any, done: (err: any, id?: any) => void) => done(null, user.id));
passport.deserializeUser(async (id: string, done: (err: any, user?: any) => void) => {
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    done(null, user);
  } catch (e) {
    done(e);
  }
});

const clientID = process.env.GOOGLE_CLIENT_ID || '';
const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
const callbackURL = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/auth/google/callback';
if (!clientID || !clientSecret) {
  console.error('Google OAuth env vars missing: GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET');
}
console.log('[OAuth] Using callback URL:', callbackURL);

passport.use(new GoogleStrategy(
  {
    clientID: clientID,
    clientSecret: clientSecret,
  callbackURL
  },
  async (_accessToken: string, _refreshToken: string, profile: Profile, done: (err: any, user?: User) => void) => {
    try {
      const email = profile.emails?.[0]?.value;
      if (!email) return done(new Error('No email from Google'));
      let user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        user = await prisma.user.create({ data: { email, name: profile.displayName, picture: profile.photos?.[0]?.value } });
      }
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }
));

app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/auth/fail' }), (req: Request, res: Response) => {
  res.redirect('http://localhost:5173/');
});

app.get('/auth/logout', (req: Request, res: Response) => {
  req.logout(err => {
    if (err) console.error(err);
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      res.json({ ok: true });
    });
  });
});

app.get('/auth/me', (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ user: null });
  res.json({ user: req.user });
});

// Knowledge Bases CRUD (simplified aggregate endpoints)
app.get('/api/bases', async (req: Request, res: Response) => {
  const email = String(req.query.email || '');
  const user = await prisma.user.findUnique({ where: { email }, include: { bases: { include: { questions: true } } } });
  if (!user) return res.json([]);
  const bases = user.bases.map(b => ({
    id: b.id,
    name: b.name,
    createdAt: b.createdAt,
    questions: b.questions.map(q => ({ id: q.id, question: q.text, options: JSON.parse(q.options), correctAnswerIndex: q.correctAnswerIdx, source: q.source || '', category: q.category || '' }))
  }));
  res.json(bases);
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
  
  console.log(`[DEBUG] GET /api/tests/${testId} for email: ${email}`);
  
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
  
  // Check if user has reached max attempts (0 = unlimited)
  if (test.maxAttempts > 0 && existingAttempts >= test.maxAttempts) {
    console.log(`[DEBUG] User has reached max attempts: ${existingAttempts}/${test.maxAttempts}`);
    return res.status(403).json({ 
      error: `Bạn đã hết lượt thi. Đã thi: ${existingAttempts}/${test.maxAttempts} lượt`,
      attempts: existingAttempts,
      maxAttempts: test.maxAttempts
    });
  }
  
  console.log(`[DEBUG] User can take test. Attempts: ${existingAttempts}/${test.maxAttempts}`);
  
  // Check if test is available (time constraints)
  const now = new Date();
  if (test.startTime && new Date(test.startTime) > now) {
    return res.status(403).json({ error: 'Test has not started yet' });
  }
  if (test.endTime && new Date(test.endTime) < now) {
    return res.status(403).json({ error: 'Test has ended' });
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
  const created = await prisma.attempt.create({ data: {
    mode: attempt.mode,
    settings: JSON.stringify(attempt.settings),
    userId: user.id,
    knowledgeBaseId: attempt.knowledgeBaseId, // This can be null for test attempts
    testId: attempt.testId, // Store testId for test attempts
    score: attempt.score,
    completedAt: attempt.completedAt ? new Date(attempt.completedAt) : null,
    answers: { create: attempt.userAnswers.map((ua: any) => ({ questionId: ua.questionId, selectedIndex: ua.selectedOptionIndex, isCorrect: ua.isCorrect })) }
  }});
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


app.listen(3000, () => console.log('API server on :3000'));
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