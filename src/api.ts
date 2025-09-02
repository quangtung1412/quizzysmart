// Dynamically derive API base (root, WITHOUT trailing / or /api)
// We append full endpoint paths (which already include /api/...).
// Dev: frontend :5173 -> backend http://localhost:3000
// Prod: same origin (assumes reverse proxy exposes /api/* to backend)
export const API_BASE = ((): string => {
  if (typeof window === 'undefined') return (process.env.API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
  const origin = window.location.origin.replace(/\/$/, '');
  if (origin.includes(':5173')) return 'http://localhost:3000';
  return origin;
})();

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(API_BASE + path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export const api = {
  me: () => request<{ user: any }>('/api/auth/me'),
  logout: () => request<{ ok: boolean }>('/api/auth/logout'),
  getBases: (email: string) => request<any[]>(`/api/bases?email=${encodeURIComponent(email)}`),
  createBase: (email: string, base: any) => request<any>( '/api/bases', { method: 'POST', body: JSON.stringify({ email, base }) }),
  deleteBase: (id: string) => request<{ ok: boolean }>(`/api/bases/${id}`, { method: 'DELETE' }),
  getUserTests: (email: string) => request<any[]>(`/api/tests?email=${encodeURIComponent(email)}`),
  getTestById: (testId: string, email: string, viewOnly?: boolean) => {
    const params = new URLSearchParams({ email });
    if (viewOnly) {
      params.append('viewOnly', 'true');
    }
    return request<any>(`/api/tests/${testId}?${params.toString()}`);
  },
  getTestStatistics: (testId: string, email: string) => request<{
    attempts: any[];
    bestScore: number | null;
    fastestTime: number | null; // in seconds
    averageScore: number | null;
  }>(`/api/tests/${testId}/statistics?email=${encodeURIComponent(email)}`),
  getTestAttempts: (testId: string, email: string) => request<any[]>(`/api/tests/${testId}/attempts?email=${encodeURIComponent(email)}`),
  getAttempts: (email: string) => request<any[]>(`/api/attempts?email=${encodeURIComponent(email)}`),
  createAttempt: (email: string, attempt: any) => request<{ id: string }>( '/api/attempts', { method: 'POST', body: JSON.stringify({ email, attempt }) }),
  updateAttempt: (id: string, data: any) => request<{ id: string }>(`/api/attempts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  getQuizResults: (attemptId: string, email: string) => request<{ attemptId: string; score: number; completedAt: string; results: any[] }>(`/api/attempts/${attemptId}/results?email=${encodeURIComponent(email)}`),
  // admin
  adminListUsers: () => request<any[]>(`/api/admin/users`),
  adminListTests: () => request<any[]>(`/api/admin/tests`),
  adminCreateTest: (payload: { 
    name: string; 
    description?: string; 
    questionCount: number;
    timeLimit: number;
    maxAttempts?: number;
    startTime?: string;
    endTime?: string;
    knowledgeSources: Array<{ knowledgeBaseId: string; percentage: number }>;
    assignedUsers: string[];
  }) => request<{ id: string }>(`/api/admin/tests`, { method: 'POST', body: JSON.stringify(payload) }),
  adminUpdateTest: (testId: string, payload: { 
    name: string; 
    description?: string; 
    questionCount: number;
    timeLimit: number;
    maxAttempts?: number;
    startTime?: string;
    endTime?: string;
    knowledgeSources: Array<{ knowledgeBaseId: string; percentage: number }>;
    assignedUsers: string[];
  }) => request<{ id: string }>(`/api/admin/tests/${testId}`, { method: 'PUT', body: JSON.stringify(payload) }),
  adminDeleteTest: (testId: string) => request<{ ok: boolean }>(`/api/admin/tests/${testId}`, { method: 'DELETE' }),
  adminAssignTest: (testId: string, userIds: string[]) => request<{ ok: boolean }>(`/api/admin/tests/${testId}/assign`, { method: 'POST', body: JSON.stringify({ userIds }) }),
  adminTestRanking: (testId: string) => request<any[]>(`/api/admin/tests/${testId}/ranking`),
  adminListKnowledgeBases: () => request<any[]>(`/api/admin/knowledge-bases`),
  adminDeleteKnowledgeBase: (baseId: string) => request<{ ok: boolean }>(`/api/admin/knowledge-bases/${baseId}`, { method: 'DELETE' }),
  adminCreateKnowledgeBase: (payload: { name: string; questions: any[] }) => request<{ id: string }>(`/api/admin/knowledge-bases`, { method: 'POST', body: JSON.stringify(payload) }),
  
  // Study Plans
  getStudyPlans: () => request<any[]>(`/api/study-plans`),
  createStudyPlan: (payload: {
    knowledgeBaseId: string;
    knowledgeBaseName: string;
    totalDays: number;
    minutesPerDay: number;
    questionsPerDay: number;
    startDate: string;
    endDate: string;
  }) => request<any>(`/api/study-plans`, { method: 'POST', body: JSON.stringify(payload) }),
  updateStudyPlan: (id: string, data: any) => request<any>(`/api/study-plans/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteStudyPlan: (id: string) => request<{ success: boolean }>(`/api/study-plans/${id}`, { method: 'DELETE' }),
  updateQuestionProgress: (studyPlanId: string, payload: {
    questionId: string;
    difficultyLevel: string;
  }) => request<{ questionProgress: any; studyPlan: any }>(`/api/study-plans/${studyPlanId}/question-progress`, { method: 'POST', body: JSON.stringify(payload) }),
  getTodayQuestions: (studyPlanId: string, maxQuestions?: number) => {
    const params = new URLSearchParams();
    if (maxQuestions) params.append('maxQuestions', maxQuestions.toString());
    return request<{ questions: any[]; studyPlan: any }>(`/api/study-plans/${studyPlanId}/today-questions?${params.toString()}`);
  }
};