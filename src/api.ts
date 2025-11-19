// Dynamically derive API base (root, WITHOUT trailing / or /api)
// We append full endpoint paths (which already include /api/...).
// Dev: frontend :5173 -> backend http://localhost:3000
// Prod: same origin (assumes reverse proxy exposes /api/* to backend)
export const API_BASE = ((): string => {
  // Server-side / build fallback
  if (typeof window === 'undefined') {
    return (process.env.API_BASE_URL || process.env.VITE_API_BASE || 'http://localhost:3000').replace(/\/$/, '');
  }

  const origin = window.location.origin.replace(/\/$/, '');
  const port = window.location.port;

  // If running in Vite dev (any 517x port) route API to backend port 3000
  if (import.meta?.env?.DEV && /^517\d$/.test(port)) {
    return (import.meta.env.VITE_API_BASE || 'http://localhost:3000').replace(/\/$/, '');
  }

  // Optional explicit override via env
  if (import.meta?.env?.VITE_API_BASE) {
    return (import.meta.env.VITE_API_BASE as string).replace(/\/$/, '');
  }

  return origin;
})();

// Type helper (Vite provides import.meta.env at runtime)
declare global {
  interface ImportMetaEnv {
    DEV?: boolean;
    VITE_API_BASE?: string;
  }
  interface ImportMeta {
    env: ImportMetaEnv;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(API_BASE + path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });

  if (!res.ok) {
    // Handle 401 Unauthorized - session expired or invalid
    if (res.status === 401) {
      // Don't auto-logout here to prevent interruption during quiz
      // Let the component handle the error gracefully
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Unauthorized');
      }
      throw new Error('Unauthorized');
    }
    throw new Error(`API ${res.status}`);
  }

  const contentType = res.headers.get("content-type");
  if (contentType && contentType.indexOf("application/json") !== -1) {
    return res.json();
  }
  // Handle non-json responses if needed
  return res.text() as any;
}

export const api = {
  get: (path: string) => request(path),
  post: (path: string, body: any) => request(path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path: string, body: any) => request(path, { method: 'PUT', body: JSON.stringify(body) }),
  me: () => request<{ user: any }>('/api/auth/me'),
  logout: () => request<{ ok: boolean }>('/api/auth/logout'),
  login: (username: string, password: string, deviceId: string) =>
    request<{ user: any; sessionToken: string; deviceId: string; wasLoggedOutFromOtherDevice: boolean }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password, deviceId })
    }),
  validateDevice: (deviceId: string, sessionToken: string) =>
    request<{ valid: boolean; error?: string; message?: string }>('/api/auth/validate-device', {
      method: 'POST',
      body: JSON.stringify({ deviceId, sessionToken })
    }),
  getBases: (email: string) => request<any[]>(`/api/bases?email=${encodeURIComponent(email)}`),
  createBase: (email: string, base: any) => request<any>('/api/bases', { method: 'POST', body: JSON.stringify({ email, base }) }),
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
  createAttempt: (email: string, attempt: any) => request<{ id: string }>('/api/attempts', { method: 'POST', body: JSON.stringify({ email, attempt }) }),
  updateAttempt: (id: string, data: any) => request<{ id: string }>(`/api/attempts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  getQuizResults: (attemptId: string, email: string) => request<{ attemptId: string; score: number; completedAt: string; results: any[] }>(`/api/attempts/${attemptId}/results?email=${encodeURIComponent(email)}`),
  // admin
  adminListUsers: () => request<any[]>(`/api/admin/users`),
  adminCreateUser: (userData: any) => request<any>(`/api/admin/users`, { method: 'POST', body: JSON.stringify(userData) }),
  adminUpdateUser: (userId: string, userData: any) => request<any>(`/api/admin/users/${userId}`, { method: 'PUT', body: JSON.stringify(userData) }),
  adminDeleteUser: (userId: string) => request<{ ok: boolean }>(`/api/admin/users/${userId}`, { method: 'DELETE' }),
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
  adminCreateKnowledgeBase: (payload: { name: string; questions: any[]; creatorEmail?: string }) => request<{ id: string }>(`/api/admin/knowledge-bases`, { method: 'POST', body: JSON.stringify(payload) }),

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
  },
  getAllHardQuestions: (studyPlanId: string) => {
    return request<{ questions: any[]; studyPlan: any }>(`/api/study-plans/${studyPlanId}/all-hard-questions`);
  },
  getSmartReviewQuestions: (studyPlanId: string) => {
    return request<{ questions: { new: any[]; hard: any[]; medium: any[]; easy: any[] }; stats: any; studyPlan: any }>(`/api/study-plans/${studyPlanId}/smart-review`);
  },
  resetStudyPlanProgress: (studyPlanId: string) => {
    return request<{ success: boolean }>(`/api/study-plans/${studyPlanId}/reset-progress`, { method: 'POST' });
  },
  // Quick Search
  getQuickSearchQuestions: (knowledgeBaseIds: string[], userEmail: string) => {
    return request<{ questions: any[]; remainingQuota: number }>(`/api/quick-search/questions`, { method: 'POST', body: JSON.stringify({ knowledgeBaseIds, userEmail }) });
  },
  // Premium Features
  searchByImage: async (imageBase64: string, knowledgeBaseIds: string[]) => {
    const res = await fetch(API_BASE + '/api/premium/search-by-image', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: imageBase64, knowledgeBaseIds })
    });

    if (!res.ok) {
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const error = await res.json();

        // Special handling for 401 Unauthorized
        if (res.status === 401) {
          throw new Error('Bạn cần đăng nhập để sử dụng tính năng này. Vui lòng đăng nhập lại.');
        }

        throw new Error(error.error || `API error: ${res.status}`);
      }

      if (res.status === 401) {
        throw new Error('Bạn cần đăng nhập để sử dụng tính năng này. Vui lòng đăng nhập lại.');
      }

      throw new Error(`API error: ${res.status} - ${res.statusText}`);
    }

    return res.json();
  },
  // Subscription/Premium Plans
  purchaseSubscription: (plan: string, transactionCode: string) => {
    return request<{ subscriptionId: string; message: string }>(`/api/subscriptions/purchase`, {
      method: 'POST',
      body: JSON.stringify({ plan, transactionCode })
    });
  },
  // PayOS Payment
  createPaymentLink: (planId: string) => {
    return request<{
      success: boolean;
      orderCode: number;
      amount: number;
      description: string;
      qrCode: string;
      checkoutUrl: string;
      paymentLinkId: string;
      accountNumber: string;
      accountName: string;
      bin: string;
      isExisting?: boolean;
    }>(`/api/premium/create-payment-link`, {
      method: 'POST',
      body: JSON.stringify({ planId })
    });
  },
  checkPaymentStatus: (orderCode: number) => {
    return request<{
      success: boolean;
      status: string;
      paid: boolean;
      amount: number;
      amountPaid?: number;
      transactions?: any[];
      activatedAt?: string;
      expiresAt?: string;
    }>(`/api/premium/payment-status/${orderCode}`);
  },
  getPendingPayment: () => {
    return request<{
      hasPending: boolean;
      planId?: string;
      orderCode?: number;
      amount?: number;
      description?: string;
      qrCode?: string;
      checkoutUrl?: string;
      paymentLinkId?: string;
      accountNumber?: string;
      accountName?: string;
      bin?: string;
      createdAt?: string;
    }>(`/api/premium/pending-payment`);
  },
  checkSubscription: () => {
    return request<{
      hasActiveSubscription: boolean;
      hasPendingSubscription?: boolean;
      plan?: string;
      expiresAt?: string;
      activatedAt?: string;
    }>(`/api/premium/check-subscription`);
  },
  checkThankYouPopup: () => {
    return request<{
      shouldShow: boolean;
    }>(`/api/premium/check-thank-you-popup`);
  },
  // Subscription Plan Management (Admin)
  adminGetSubscriptionPlans: () => request<any[]>(`/api/admin/subscription-plans`),
  adminCreateSubscriptionPlan: (payload: {
    planId: string;
    name: string;
    price: number;
    aiQuota: number;
    duration: number;
    features: string[];
    isActive?: boolean;
    displayOrder?: number;
    popular?: boolean;
  }) => request<any>(`/api/admin/subscription-plans`, { method: 'POST', body: JSON.stringify(payload) }),
  adminUpdateSubscriptionPlan: (id: string, payload: {
    planId?: string;
    name?: string;
    price?: number;
    aiQuota?: number;
    duration?: number;
    features?: string[];
    isActive?: boolean;
    displayOrder?: number;
    popular?: boolean;
  }) => request<any>(`/api/admin/subscription-plans/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  adminDeleteSubscriptionPlan: (id: string) => request<{ ok: boolean }>(`/api/admin/subscription-plans/${id}`, { method: 'DELETE' }),
  // Subscription Management (Admin)
  getAdminSubscriptions: (status?: string) => {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    return request<any[]>(`/api/admin/subscriptions?${params.toString()}`);
  },
  createAdminSubscription: (payload: {
    userId: string;
    planId: string;
    durationDays?: number;
    notes?: string;
  }) => request<any>(`/api/admin/subscriptions`, { method: 'POST', body: JSON.stringify(payload) }),
  updateAdminSubscription: (id: string, payload: {
    status?: string;
    expiresAt?: string;
    notes?: string;
  }) => request<any>(`/api/admin/subscriptions/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteAdminSubscription: (id: string) => request<{ ok: boolean }>(`/api/admin/subscriptions/${id}`, { method: 'DELETE' }),
  extendAdminSubscription: (id: string, days: number) =>
    request<any>(`/api/admin/subscriptions/${id}/extend`, { method: 'POST', body: JSON.stringify({ days }) }),
  getAdminSubscriptionPlans: () => request<any[]>(`/api/admin/subscription-plans`),
  getAdminUsers: () => request<any[]>(`/api/admin/users`),
  // Public endpoint
  getSubscriptionPlans: () => request<any[]>(`/api/subscription-plans`),
  decrementQuickSearchQuota: () => request<{ remainingQuota: number }>('/api/users/decrement-quick-search-quota', { method: 'POST' }),
  // Peak Hours Status
  getPeakHoursStatus: () => request<{
    isPeakHours: boolean;
    enabled: boolean;
    peakHoursStart?: string;
    peakHoursEnd?: string;
    peakHoursDays?: number[];
  }>('/api/peak-hours-status'),

  // Chat / RAG Q&A
  chatAsk: (question: string) => request<{
    message: {
      id: number;
      userId: number;
      question: string;
      answer: string;
      sources: any[];
      confidence?: number;
      createdAt: string;
    };
  }>('/api/chat/ask', { method: 'POST', body: JSON.stringify({ question }) }),
  chatHistory: (limit: number = 50, offset: number = 0) => request<{
    messages: any[];
    total: number;
  }>(`/api/chat/history?limit=${limit}&offset=${offset}`),
  chatDeleteMessage: (messageId: number) => request<{ ok: boolean }>(`/api/chat/history/${messageId}`, { method: 'DELETE' }),
  chatStats: () => request<{
    totalMessages: number;
    totalTokensUsed: number;
    averageConfidence: number;
  }>('/api/chat/stats'),
  chatGetDocuments: () => request<{
    documents: Array<{
      id: string;
      fileName: string;
      documentName: string;
      documentNumber: string;
      documentType: string;
    }>;
  }>('/api/chat/documents'),

  // RAG Configuration (Admin)
  ragConfigGet: () => request<{
    success: boolean;
    config: { method: string; fileSearchStoreName?: string };
    stats: any;
  }>('/api/rag-config'),
  ragConfigSet: (method: string, fileSearchStoreName?: string) => request<{
    success: boolean;
    message: string;
    config: any;
  }>('/api/rag-config', {
    method: 'POST',
    body: JSON.stringify({ method, fileSearchStoreName })
  }),
  ragConfigListStores: () => request<{
    success: boolean;
    stores: Array<{ name: string; displayName: string; createTime: string }>;
  }>('/api/rag-config/file-search-stores'),
  ragConfigCreateStore: (displayName: string) => request<{
    success: boolean;
    message: string;
    store: any;
  }>('/api/rag-config/file-search-stores', {
    method: 'POST',
    body: JSON.stringify({ displayName })
  }),
  ragConfigDeleteStore: (storeName: string) => request<{
    success: boolean;
    message: string;
  }>(`/api/rag-config/file-search-stores/${encodeURIComponent(storeName)}`, {
    method: 'DELETE'
  }),
  ragConfigListDocuments: (ragMethod?: string, fileSearchStoreName?: string) => {
    const params = new URLSearchParams();
    if (ragMethod) params.append('ragMethod', ragMethod);
    if (fileSearchStoreName) params.append('fileSearchStoreName', fileSearchStoreName);
    return request<{
      success: boolean;
      documents: any[];
    }>(`/api/rag-config/documents?${params.toString()}`);
  },
  ragConfigDeleteDocument: (documentId: string) => request<{
    success: boolean;
    message: string;
  }>(`/api/rag-config/documents/${documentId}`, { method: 'DELETE' }),
  ragConfigUploadToFileSearch: async (file: File, fileSearchStoreName: string, displayName: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('fileSearchStoreName', fileSearchStoreName);
    formData.append('displayName', displayName);

    const res = await fetch(`${API_BASE}/api/rag-config/upload-to-file-search`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(errorText || `HTTP ${res.status}`);
    }

    return res.json();
  },
};