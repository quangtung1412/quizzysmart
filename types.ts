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
