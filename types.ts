export interface Question {
  id: string; // use string (uuid) to avoid collisions
  question: string;
  options: string[];
  /** Mapping of shuffled option index to original option index when options are shuffled. */
  optionMapping?: number[];
  /** Single: 0..n-1. Multi-correct: negative bitmask of 0-based option indices (e.g. Excel "1,2,4" → -11). */
  correctAnswerIndex: number;
  /** Explicit multi flag for test mode when correctAnswerIndex is hidden from the client. */
  isMultiSelect?: boolean;
  source: string;
  category: string;
}

export interface KnowledgeBase {
  id: string;
  name: string;
  questions: Question[];
  createdAt: string;
}

export type UserRole = 'admin' | 'user';

export interface User {
  id: string;
  username?: string;
  googleId?: string;
  name: string;
  email?: string;
  branchCode?: string;
  isAdmin?: boolean;
  picture?: string;
  aiSearchQuota?: number; // Number of AI searches remaining
  quickSearchQuota?: number; // Number of quick searches remaining (free trial)
  role?: UserRole;
  hasQuickSearchAccess?: boolean; // Quick Search feature access
  premiumPlan?: string | null; // 'plus' | 'premium' | 'max' | null
  premiumExpiresAt?: string | null; // ISO date string
}

export interface AppUser {
  id?: string;
  name: string;
  email?: string;
  username?: string;
  picture?: string;
  role?: UserRole;
}

export interface AdminTestSummary {
  id: string;
  name: string;
  knowledgeBaseId: string;
  questionCount: number;
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
  createdAt: string;
}

export interface TestRankingEntry {
  attemptId: string;
  userEmail: string;
  score: number;
  completedAt: string | null;
}

export enum QuizMode {
  Study = 'study',
  Exam = 'exam',
  Test = 'test', // For assigned tests
}

export interface QuizSettings {
  categories: string[];
  questionCount: number;
  timeLimit: number; // in seconds
}

export type UserAnswer = {
  questionId: string;
  selectedOptionIndex: number | null;
  isCorrect: boolean | null;
};

export interface QuizAttempt {
  id: string;
  knowledgeBaseId: string;
  knowledgeBaseName: string;
  mode: QuizMode;
  settings: QuizSettings;
  startedAt: string;
  completedAt: string | null;
  userAnswers: UserAnswer[];
  score: number | null; // Stored as percentage, e.g., 85.5
}

// Personal Study Plan Types
export enum DifficultyLevel {
  Easy = 'easy',
  Medium = 'medium',
  Hard = 'hard'
}

export enum StudyPhase {
  Initial = 'initial',      // Giai đoạn 1: Học hết tất cả câu hỏi
  Review = 'review'         // Giai đoạn 2: Làm bài thi thử tổng hợp
}

export interface QuestionProgress {
  id: string;
  questionId: string;
  difficultyLevel: DifficultyLevel | null;
  lastReviewed: string | null;
  reviewCount: number;
  nextReviewAfter: number | null; // Number of new questions to learn before reviewing this again
}

export interface StudyPlan {
  id: string;
  userId: string;
  knowledgeBaseId: string;
  knowledgeBaseName: string;
  totalDays: number;
  minutesPerDay: number;
  questionsPerDay: number;
  currentPhase: StudyPhase;
  startDate: string;
  endDate: string;
  currentDay: number;
  newQuestionsLearned: number; // Number of new questions learned so far
  questionProgress: QuestionProgress[];
  completedQuestions: string[]; // IDs of questions marked as "easy"
  createdAt: string;
  updatedAt: string;
}

export interface ProgressStats {
  total: number;
  reviewed: number;
  easy: number;
  medium: number;
  hard: number;
  unrated: number;
}

export function isCorrectAnswerIndex(correctAnswerIndex: number | undefined | null, optionIndex: number): boolean {
  if (correctAnswerIndex === undefined || correctAnswerIndex === null) return false;
  if (correctAnswerIndex < 0) {
    const mask = Math.abs(correctAnswerIndex);
    return (mask & (1 << optionIndex)) !== 0;
  }
  return correctAnswerIndex === optionIndex;
}

/** True when the question allows selecting multiple options. Prefers explicit flag (test mode). */
export function isMultiSelectQuestion(q: {
  correctAnswerIndex?: number | null;
  isMultiSelect?: boolean;
}): boolean {
  if (typeof q.isMultiSelect === 'boolean') return q.isMultiSelect;
  return typeof q.correctAnswerIndex === 'number' && q.correctAnswerIndex < 0;
}
