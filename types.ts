export interface Question {
  id: string; // use string (uuid) to avoid collisions
  question: string;
  options: string[];
  correctAnswerIndex: number; // 0..options.length-1
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

export interface AppUser {
  id?: string;
  name: string;
  email: string;
  picture: string;
  role?: UserRole;
}

export interface AdminTestSummary {
  id: string;
  name: string;
  knowledgeBaseId: string;
  questionCount: number;
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
