import React, { useState, useCallback, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Question, QuizMode, QuizSettings, UserAnswer, KnowledgeBase, QuizAttempt, User, StudyPlan, DifficultyLevel } from './types';
import { useKnowledgeBaseStore, useAttemptStore } from './src/hooks/usePersistentStores';
import { useStudyPlanStore } from './src/hooks/useStudyPlanStore';
import { shuffleArray } from './src/utils/shuffle';
import { api } from './src/api';
import { initSocket, disconnectSocket } from './src/socket';
import { clearDeviceSession, getDeviceId, getSessionToken } from './src/utils/deviceId';
import FileUpload from './components/FileUpload';
import MainMenu from './components/MainMenu';
import SetupScreen from './components/SetupScreen';
import QuizScreen from './components/QuizScreen';
import ResultsScreen from './components/ResultsScreen';
import LoginScreen from './components/LoginScreen';
import RegisterScreen from './components/RegisterScreen';
import UserSetupScreen from './components/UserSetupScreen';
import AdminDashboard from './components/AdminDashboard';
import KnowledgeBaseScreen from './components/KnowledgeBaseScreen';
import QuizHistoryScreen from './components/QuizHistoryScreen';
import TestListScreen from './components/TestListScreen';
import TestDetailScreen from './components/TestDetailScreen';
import AttemptDetailScreen from './components/AttemptDetailScreen';
import ModeSelectionScreen from './components/ModeSelectionScreen';
import StudyPlanSetupScreen from './components/StudyPlanSetupScreen';
import StudyPlanOverviewScreen from './components/StudyPlanOverviewScreen';
import StudyPlanListScreen from './components/StudyPlanListScreen';
import DailyStudy from './components/DailyStudy';
import SmartReview from './components/SmartReview';
import QuickSearchScreen from './components/QuickSearchScreen';
import PremiumIntroScreen from './components/PremiumIntroScreen';
import LiveCameraSearch from './components/LiveCameraSearch';
import PremiumPlansScreen from './components/PremiumPlansScreen';

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactElement; user: User | null }> = ({ children, user }) => {
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

// Layout Component with Header and Footer
const AppLayout: React.FC<{
  user: User | null;
  onLogout: () => void;
  onGoToPremiumPlans: () => void;
  children: React.ReactNode;
}> = ({ user, onLogout, onGoToPremiumPlans, children }) => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-1 sm:p-2 bg-slate-50 text-slate-800">
      <div className="w-full max-w-8xl mx-auto relative">
        <header className="mb-3 sm:mb-4">
          {/* Mobile Layout - Logo và tên ở trái, user info ở phải */}
          <div className="flex items-start justify-between mb-2 sm:mb-1">
            {/* Logo và tên website - Bên trái */}
            <div className="flex items-center gap-1 sm:gap-2">
              <img src="/images/logo.svg" alt="Quizzy Smart Logo" className="w-8 h-8 sm:w-12 sm:h-12" />
              <div className="flex flex-col items-start">
                <h1 className="text-lg sm:text-3xl font-bold text-red-800 leading-tight">
                  <span className="hidden sm:inline">Quizzy Smart</span>
                  <span className="inline sm:hidden">Quizzy Smart</span>
                </h1>
                <p className="text-slate-500 text-xs sm:text-base sm:hidden">Ôn thi thông minh</p>
              </div>
            </div>

            {/* User Info - Bên phải */}
            {user && (
              <div className="flex items-center gap-1 sm:gap-3 flex-shrink-0">
                {/* Premium Button - Bên trái AI quota cho user thường/plus */}
                {(!user.premiumPlan || user.premiumPlan === 'plus') && (
                  <button
                    onClick={onGoToPremiumPlans}
                    className="bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white font-bold py-2 px-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2 animate-pulse"
                    title={user.premiumPlan === 'plus' ? 'Nâng cấp Premium' : 'Mua gói Premium'}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                      <path fillRule="evenodd" d="M10 1c-1.828 0-3.623.149-5.371.435a.75.75 0 00-.629.74v.387c-.827.157-1.642.345-2.445.564a.75.75 0 00-.552.698 5 5 0 004.503 5.152 6 6 0 002.946 1.822A6.451 6.451 0 017.768 13H7.5A1.5 1.5 0 006 14.5V17h-.75C4.56 17 4 17.56 4 18.25c0 .414.336.75.75.75h10.5a.75.75 0 00.75-.75c0-.69-.56-1.25-1.25-1.25H14v-2.5a1.5 1.5 0 00-1.5-1.5h-.268a6.453 6.453 0 01-.684-2.202 6 6 0 002.946-1.822 5 5 0 004.503-5.152.75.75 0 00-.552-.698A31.804 31.804 0 0016 2.562v-.387a.75.75 0 00-.629-.74A33.227 33.227 0 0010 1zM2.525 4.422C3.012 4.3 3.504 4.19 4 4.09V5c0 .74.134 1.448.38 2.103a3.503 3.503 0 01-1.855-2.68zm14.95 0a3.503 3.503 0 01-1.854 2.68C15.866 6.449 16 5.74 16 5v-.91c.496.099.988.21 1.475.332z" clipRule="evenodd" />
                    </svg>
                    <span className="hidden sm:inline">
                      {user.premiumPlan === 'plus' ? 'Nâng cấp Premium' : 'Nâng cấp Premium'}
                    </span>
                  </button>
                )}

                {/* AI Quota Display - For all users - Same style for everyone */}
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full shadow-sm bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200">
                  <span className="text-lg">💎</span>
                  <span className="text-sm font-bold text-blue-700">
                    {user.aiSearchQuota || 0}
                  </span>
                </div>

                {/* Quick Search Quota Display - Only for free users (not admin, not premium, not plus) */}
                {user.role !== 'admin' && !user.premiumPlan && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full shadow-sm bg-gradient-to-r from-purple-50 to-violet-50 border border-purple-200">
                    <span className="text-lg">⚡</span>
                    <span className="text-sm font-bold text-blue-700">
                      {user.quickSearchQuota || 0}
                    </span>
                  </div>
                )}

                {/* User Info with Premium Styling */}
                <div className={`flex items-center gap-2 bg-white p-2 rounded-full shadow-sm transition-all duration-200 ${user.premiumPlan === 'plus'
                  ? 'border-2 border-purple-500 shadow-purple-200'
                  : user.premiumPlan === 'premium'
                    ? 'border-2 border-yellow-500 shadow-yellow-200'
                    : 'border border-slate-200'
                  }`}>
                  {user.picture && <img src={user.picture} alt={user.name} className="w-8 h-8 rounded-full" />}

                  <div className="hidden sm:flex flex-col items-start">
                    <span className={`text-sm font-medium ${user.premiumPlan === 'plus'
                      ? 'text-purple-700 font-bold'
                      : user.premiumPlan === 'premium'
                        ? 'text-yellow-700 font-bold'
                        : 'text-slate-600'
                      }`}>
                      Chào, {user.name}
                    </span>
                  </div>

                  <button
                    onClick={onLogout}
                    title="Đăng xuất"
                    className="p-2 text-slate-500 hover:bg-slate-100 hover:text-red-600 rounded-full transition-colors"
                    aria-label="Đăng xuất"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Subtitle - Hiện bên trái trên desktop */}
          <p className="text-slate-500 text-left hidden sm:block ml-1 text-sm">Ôn thi trắc nghiệm thông minh</p>
        </header>
        <main className="bg-white p-3 sm:p-4 rounded-xl shadow-lg transition-all duration-300">
          {children}
        </main>
        <footer className="text-center mt-2 sm:mt-3 text-xs sm:text-sm text-slate-400">
          <p>©2025 - Quizzy Smart</p>
        </footer>
      </div>
    </div>
  );
};

const AppContent: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [forceLogoutMessage, setForceLogoutMessage] = useState<string | null>(null);
  const [showThankYouPopup, setShowThankYouPopup] = useState<boolean>(false);
  const [thankYouData, setThankYouData] = useState<any>(null);

  // Prevent browser/Android back navigation (soft back) while in app
  useEffect(() => {
    const blockPop = (e: PopStateEvent) => {
      // We'll let React Router handle navigation, but prevent default browser back
      // This is commented out to allow React Router to work properly
      // history.pushState(null, document.title, window.location.href);
    };
    // Seed an extra history entry so first back is trapped
    // history.pushState(null, document.title, window.location.href);
    // window.addEventListener('popstate', blockPop);
    // return () => window.removeEventListener('popstate', blockPop);
  }, []);

  // Setup Socket.IO connection and listen for force-logout
  useEffect(() => {
    if (!user?.id) return;

    const socket = initSocket(user.id);

    // Listen for force-logout event
    socket.on('force-logout', (data: { reason: string; message: string }) => {
      console.log('[Force Logout]', data);
      setForceLogoutMessage(data.message);

      // Clear device session
      clearDeviceSession();

      // Logout user
      handleLogout();
    });

    return () => {
      disconnectSocket();
    };
  }, [user?.id]);

  // Device session validation on app start (only once per user login)
  useEffect(() => {
    if (!user?.id) return;

    const validateSession = async () => {
      try {
        const deviceId = getDeviceId();
        const sessionToken = getSessionToken();

        if (!sessionToken) {
          console.log('[Device] No session token found');
          return;
        }

        const result = await api.validateDevice(deviceId, sessionToken);

        if (!result.valid) {
          console.log('[Device] Session invalid:', result.message);
          setForceLogoutMessage(result.message || 'Phiên đăng nhập không hợp lệ');
          handleLogout();
        } else {
          console.log('[Device] Session is valid');
        }
      } catch (error) {
        console.error('[Device] Validation error:', error);
        // Don't logout on validation error to prevent interruption during quiz
        // Only logout on explicit invalid session from server
      }
    };

    // Only validate once when user is logged in
    validateSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Check for pending thank you popup when entering ModeSelectionScreen
  useEffect(() => {
    if (!user?.id) return;

    const checkThankYouPopup = async () => {
      try {
        const result = await api.checkThankYouPopup();
        if (result.shouldShow) {
          // Get user's current subscription info to show in popup
          const freshUserData = await refreshUserData();
          if (freshUserData) {
            // Find most recent active subscription for display
            setThankYouData({
              plan: freshUserData.premiumPlan || 'premium',
              planName: freshUserData.premiumPlan === 'plus' ? 'Plus' : 'Premium',
              aiQuota: freshUserData.aiSearchQuota || 0,
              expiresAt: freshUserData.premiumExpiresAt || new Date()
            });
            setShowThankYouPopup(true);
          }
        }
      } catch (error) {
        console.error('[Thank You Popup] Error checking:', error);
      }
    };

    checkThankYouPopup();
  }, [user?.id]);

  const { bases: knowledgeBases, addBase, removeBase, setBases: setKnowledgeBases } = useKnowledgeBaseStore(user?.email || user?.username || null);
  const { attempts: quizAttempts, createAttempt, updateAttempt, setAttempts: setQuizAttempts } = useAttemptStore(user?.email || user?.username || null);
  const { studyPlans, createStudyPlan, updateStudyPlan, updateQuestionProgress, getTodayQuestions, deleteStudyPlan, refreshStudyPlans, getStudyPlanByKnowledgeBaseId } = useStudyPlanStore(user?.email || user?.username || null);

  const [selectedKnowledgeBase, setSelectedKnowledgeBase] = useState<KnowledgeBase | null>(null);
  const [currentStudyPlan, setCurrentStudyPlan] = useState<StudyPlan | null>(null);

  const [allQuestions, setAllQuestions] = useState<Question[]>([]);

  const [quizMode, setQuizMode] = useState<QuizMode | null>(null);
  const [quizSettings, setQuizSettings] = useState<QuizSettings | null>(null);
  const [activeQuizQuestions, setActiveQuizQuestions] = useState<Question[]>([]);
  const [userAnswers, setUserAnswers] = useState<UserAnswer[]>([]);
  const [currentAttemptId, setCurrentAttemptId] = useState<string | null>(null);

  // State for current test information
  const [currentTestInfo, setCurrentTestInfo] = useState<{
    name?: string;
    maxAttempts?: number;
    currentAttempt?: number;
  } | null>(null);

  // Hydrate unfinished attempt after refresh
  useEffect(() => {
    if (!currentAttemptId) return;
    const attempt = quizAttempts.find(a => a.id === currentAttemptId);
    if (attempt && attempt.userAnswers.length && activeQuizQuestions.length === 0) {
      const kb = knowledgeBases.find(b => b.id === attempt.knowledgeBaseId);
      if (kb) {
        const applicable = attempt.settings.categories.length
          ? kb.questions.filter(q => attempt.settings.categories.includes(q.category))
          : kb.questions;
        const questionMap = new Map(applicable.map(q => [q.id, q]));
        const restored: Question[] = attempt.userAnswers
          .map(a => questionMap.get(a.questionId))
          .filter((q): q is Question => !!q)
          .slice(0, attempt.settings.questionCount);
        setActiveQuizQuestions(restored);
        setUserAnswers(attempt.userAnswers);
        setQuizSettings(attempt.settings);
        setQuizMode(attempt.mode);
      }
    }
  }, [currentAttemptId, quizAttempts, knowledgeBases, activeQuizQuestions.length]);

  // Function to refresh user data
  const refreshUserData = useCallback(async () => {
    try {
      const r = await api.me();
      if (r.user) {
        const userData: User = {
          id: r.user.id,
          username: r.user.username,
          googleId: r.user.googleId,
          name: r.user.name || '',
          email: r.user.email,
          branchCode: r.user.branchCode,
          isAdmin: (r.user as any).role === 'admin',
          picture: r.user.picture || '',
          aiSearchQuota: (r.user as any).aiSearchQuota || 0,
          quickSearchQuota: (r.user as any).quickSearchQuota || 0,
          hasQuickSearchAccess: (r.user as any).hasQuickSearchAccess || false,
          premiumPlan: (r.user as any).premiumPlan || null,
          premiumExpiresAt: (r.user as any).premiumExpiresAt || null,
          role: (r.user as any).role
        };
        setUser(userData);
        return userData;
      }
    } catch (error: any) {
      // Don't log 401 errors - they're expected when user is not logged in
      if (!error?.message?.includes('401')) {
        console.error('Failed to refresh user data:', error);
      }
    }
    return null;
  }, []);

  const handleLoginSuccess = useCallback(async (loggedInUser: User) => {
    // Refresh user data to get latest quota and premium info
    const freshUserData = await refreshUserData();

    const userData = freshUserData || loggedInUser;
    setUser(userData);

    // Check if user needs to complete setup (missing branchCode)
    if (!userData.branchCode) {
      navigate('/user-setup');
    } else {
      navigate('/');
    }
  }, [refreshUserData, navigate]);

  const handleUserSetupComplete = useCallback((updatedUser: User) => {
    setUser(updatedUser);
    navigate('/');
  }, [navigate]);

  // Initial user data refresh on app start (only once)
  useEffect(() => {
    refreshUserData().then(userData => {
      if (userData) {
        // Check if user needs to complete setup
        if (!userData.branchCode) {
          navigate('/user-setup');
        } else {
          navigate('/');
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

  const handleLogout = useCallback(async () => {
    try {
      await api.logout();
    } catch (error) {
      console.error('Logout error:', error);
    }

    // Clear device session data
    clearDeviceSession();

    setUser(null);
    navigate('/login');
    setKnowledgeBases([]);
    setAllQuestions([]);
    setQuizMode(null);
    setQuizSettings(null);
    setActiveQuizQuestions([]);
    setUserAnswers([]);
    setQuizAttempts([]);
    setSelectedKnowledgeBase(null);
    setCurrentAttemptId(null);
    setForceLogoutMessage(null);
  }, [navigate]);

  // Handler functions using navigate
  const handleStartTest = useCallback(async (testId: string) => {
    if (!user) return;

    const userEmail = user.email || user.username || '';
    if (!userEmail) return;

    try {
      // Get test data with questions
      const testData = await api.getTestById(testId, userEmail);

      // Convert test questions to our Question format
      const testQuestions: Question[] = testData.questions.map((q: any) => ({
        id: q.id,
        question: q.question,
        options: q.options,
        correctAnswerIndex: -1, // We don't know the correct answer on client side
        source: q.source || '',
        category: q.category || ''
      }));

      // Create initial answers
      const initialAnswers = testQuestions.map((q: Question) => ({
        questionId: q.id,
        selectedOptionIndex: null,
        isCorrect: null
      }));

      // Create a new attempt for the test
      const newAttempt = await createAttempt(userEmail, {
        testId: testId,
        knowledgeBaseName: testData.name,
        mode: QuizMode.Test,
        settings: {
          questionCount: testData.questionCount,
          timeLimit: testData.timeLimit,
          categories: []
        },
        startedAt: new Date().toISOString(),
        completedAt: null,
        userAnswers: initialAnswers,
        score: null,
        isTest: true
      } as any);

      // Set test information for quiz screen
      setCurrentTestInfo({
        name: testData.name,
        maxAttempts: testData.maxAttempts,
        currentAttempt: testData.currentAttempt
      });

      // Set up the quiz state
      setActiveQuizQuestions(testQuestions);
      setUserAnswers(initialAnswers);
      setCurrentAttemptId(newAttempt.id);
      setQuizMode(QuizMode.Test);
      setQuizSettings({
        questionCount: testData.questionCount,
        timeLimit: testData.timeLimit,
        categories: []
      });

      // Navigate to quiz screen
      navigate('/quiz');

    } catch (error: any) {
      console.error('Failed to start test:', error);
      alert(`Không thể bắt đầu làm bài: ${error.message || 'Lỗi không xác định'}`);
    }
  }, [user, createAttempt, navigate]);

  const handleSaveNewBase = useCallback(async (name: string, questions: Question[]) => {
    if (!user) return;
    const userEmail = user.email || user.username || '';
    if (!userEmail) return;

    const created = await addBase(userEmail, { name, questions } as any);
    setAllQuestions(created.questions);
    setSelectedKnowledgeBase(created as any);
    navigate('/menu');
  }, [user, addBase, navigate]);

  const handleSelectBase = useCallback((baseId: string) => {
    const selectedBase = knowledgeBases.find(b => b.id === baseId);
    if (selectedBase) {
      setAllQuestions(selectedBase.questions);
      setSelectedKnowledgeBase(selectedBase);
      navigate('/menu');
    }
  }, [knowledgeBases, navigate]);

  const handleModeSelect = useCallback((mode: QuizMode) => {
    setQuizMode(mode);
    navigate('/setup');
  }, [navigate]);

  const handleStartQuiz = useCallback(async (settings: QuizSettings) => {
    if (!selectedKnowledgeBase || !user) return;

    const userEmail = user.email || user.username || '';
    if (!userEmail) return;

    setQuizSettings(settings);

    let filteredQuestions = settings.categories.length > 0
      ? allQuestions.filter(q => settings.categories.includes(q.category))
      : allQuestions;

    const shuffled: Question[] = shuffleArray(filteredQuestions) as Question[];
    const selectedQuestions: Question[] = (shuffled as Question[]).slice(0, settings.questionCount);
    const initialAnswers = selectedQuestions.map((q: Question) => ({ questionId: q.id, selectedOptionIndex: null, isCorrect: null }));

    const newAttempt = await createAttempt(userEmail, {
      knowledgeBaseId: selectedKnowledgeBase.id,
      knowledgeBaseName: selectedKnowledgeBase.name,
      mode: quizMode!,
      settings,
      startedAt: new Date().toISOString(),
      completedAt: null,
      userAnswers: initialAnswers,
      score: null,
    } as any);
    setCurrentAttemptId(newAttempt.id);

    setActiveQuizQuestions(selectedQuestions);
    setUserAnswers(initialAnswers);
    navigate('/quiz');
  }, [allQuestions, selectedKnowledgeBase, quizMode, user, createAttempt, navigate]);

  const handleAnswerUpdate = useCallback((updatedAnswers: UserAnswer[]) => {
    if (!currentAttemptId) return;
    updateAttempt(currentAttemptId, { userAnswers: updatedAnswers } as any);
  }, [currentAttemptId, updateAttempt]);

  const handleQuizComplete = useCallback(async (finalAnswers: UserAnswer[]) => {
    if (currentAttemptId) {
      const correctCount = finalAnswers.filter(a => a.isCorrect).length;
      const totalCount = finalAnswers.length;
      const score = totalCount > 0 ? parseFloat(((correctCount / totalCount) * 100).toFixed(2)) : 0;

      try {
        // Update attempt on server - this will make it available for results API
        await updateAttempt(currentAttemptId, { userAnswers: finalAnswers, completedAt: new Date().toISOString(), score } as any);

        // Set user answers for the results screen
        setUserAnswers(finalAnswers);

        // Navigate to results screen - don't clear currentAttemptId yet so ResultsScreen can use it
        navigate('/results');
      } catch (error) {
        console.error('Failed to submit quiz:', error);
        alert('Có lỗi xảy ra khi nộp bài. Vui lòng thử lại.');
      }
    } else {
      // Fallback if no attempt ID
      setUserAnswers(finalAnswers);
      navigate('/results');
    }
  }, [currentAttemptId, updateAttempt, navigate]);

  const handleCreateStudyPlanRequest = useCallback((knowledgeBase: KnowledgeBase) => {
    setSelectedKnowledgeBase(knowledgeBase);
    setAllQuestions(knowledgeBase.questions);
    navigate('/study-plan/setup');
  }, [navigate]);

  const handleCreateStudyPlan = useCallback(async (totalDays: number, minutesPerDay: number) => {
    if (!selectedKnowledgeBase || !user) return;

    try {
      const newStudyPlan = await createStudyPlan(
        selectedKnowledgeBase.id,
        selectedKnowledgeBase.name,
        selectedKnowledgeBase.questions.length,
        totalDays,
        minutesPerDay
      );

      setCurrentStudyPlan(newStudyPlan);
      navigate('/study-plan/overview');
    } catch (error) {
      console.error('Error creating study plan:', error);
      alert('Có lỗi xảy ra khi tạo lộ trình ôn tập. Vui lòng thử lại.');
    }
  }, [selectedKnowledgeBase, user, createStudyPlan, navigate]);

  const handleViewStudyPlan = useCallback((knowledgeBase: KnowledgeBase) => {
    setSelectedKnowledgeBase(knowledgeBase);
    setAllQuestions(knowledgeBase.questions);
    navigate('/study-plan/list');
  }, [navigate]);

  const handleSelectStudyPlanFromList = useCallback((plan: StudyPlan) => {
    setCurrentStudyPlan(plan);
    navigate('/study-plan/overview');
  }, [navigate]);

  const handleDeleteStudyPlanFromList = useCallback(async (planId: string) => {
    await deleteStudyPlan(planId);
  }, [deleteStudyPlan]);

  const handleDeleteStudyPlan = useCallback(() => {
    if (!currentStudyPlan) return;

    deleteStudyPlan(currentStudyPlan.id);
    setCurrentStudyPlan(null);
    navigate('/knowledge-base');
  }, [currentStudyPlan, deleteStudyPlan, navigate]);

  const handleUpdateStudyPlan = useCallback((updatedPlan: StudyPlan) => {
    updateStudyPlan(updatedPlan.id, updatedPlan);
    setCurrentStudyPlan(updatedPlan);
  }, [updateStudyPlan]);

  const handleStartPhase2 = useCallback(() => {
    if (!currentStudyPlan || !selectedKnowledgeBase) return;

    const allQs = selectedKnowledgeBase.questions;
    const shuffled = shuffleArray([...allQs]) as Question[];

    setActiveQuizQuestions(shuffled);
    setQuizMode(QuizMode.Exam);
    setQuizSettings({
      questionCount: allQs.length,
      timeLimit: Math.max(allQs.length * 2, 30),
      categories: []
    });
    navigate('/quiz');
  }, [currentStudyPlan, selectedKnowledgeBase, navigate]);

  // Update current study plan when studyPlans array changes
  useEffect(() => {
    if (currentStudyPlan && studyPlans.length > 0) {
      const refreshedPlan = studyPlans.find(plan => plan.id === currentStudyPlan.id);
      if (refreshedPlan && JSON.stringify(refreshedPlan) !== JSON.stringify(currentStudyPlan)) {
        setCurrentStudyPlan(refreshedPlan);
      }
    }
  }, [studyPlans, currentStudyPlan]);

  // Thank You Modal Component
  const ThankYouModal = () => {
    if (!showThankYouPopup || !thankYouData) return null;

    const planName = thankYouData.planName || 'Premium';
    let planColor = 'from-purple-500 to-indigo-500';

    if (thankYouData.plan === 'premium') {
      planColor = 'from-yellow-500 to-amber-500';
    }

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm animate-fadeIn overflow-y-auto">
        <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full my-8 overflow-hidden animate-slideUp">
          {/* Header with gradient - Compact */}
          <div className={`bg-gradient-to-r ${planColor} px-6 py-8 text-center relative overflow-hidden`}>
            <div className="absolute top-0 right-0 w-24 h-24 bg-white opacity-10 rounded-full -mr-12 -mt-12"></div>
            <div className="absolute bottom-0 left-0 w-20 h-20 bg-white opacity-10 rounded-full -ml-10 -mb-10"></div>

            <div className="relative z-10">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-full mb-3 shadow-lg">
                <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white mb-1">
                Thanh toán thành công!
              </h2>
              <p className="text-white text-opacity-90">
                Chào mừng bạn đến với gói {planName}
              </p>
            </div>
          </div>

          {/* Content - Compact */}
          <div className="px-6 py-6">
            <div className="text-center mb-5">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-r from-amber-400 to-yellow-400 rounded-full mb-3">
                <span className="text-2xl">🙏</span>
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">
                Cảm ơn bạn rất nhiều!
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Sự ủng hộ của bạn giúp chúng tôi phát triển website tốt hơn.
              </p>
            </div>

            <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-slate-600 text-sm font-medium">Gói đã kích hoạt:</span>
                <span className={`px-3 py-1.5 rounded-full text-white font-bold text-xs bg-gradient-to-r ${planColor}`}>
                  {planName}
                </span>
              </div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-slate-600 text-sm font-medium">AI Search:</span>
                <span className="text-green-600 font-bold">
                  {thankYouData.aiQuota} lượt
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 text-sm font-medium">Hết hạn:</span>
                <span className="text-slate-700 font-semibold text-sm">
                  {new Date(thankYouData.expiresAt).toLocaleDateString('vi-VN')}
                </span>
              </div>
            </div>

            <div className="bg-green-50 border-2 border-green-200 rounded-xl p-3 mb-5">
              <div className="flex items-center gap-2">
                <div className="flex-shrink-0 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="font-semibold text-green-800 text-sm">
                  Tất cả tính năng Premium đã kích hoạt
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                setShowThankYouPopup(false);
                setThankYouData(null);
              }}
              className="w-full py-3 px-6 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              Khám phá ngay
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <ThankYouModal />
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={
          forceLogoutMessage ? (
            <div className="min-h-screen flex flex-col items-center justify-center p-4">
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-center">
                <p className="text-red-700 font-medium">⚠️ {forceLogoutMessage}</p>
              </div>
              <LoginScreen onLoginSuccess={handleLoginSuccess} onSwitchToRegister={() => navigate('/register')} />
            </div>
          ) : (
            <LoginScreen onLoginSuccess={handleLoginSuccess} onSwitchToRegister={() => navigate('/register')} />
          )
        } />
        <Route path="/register" element={<RegisterScreen onSwitchToLogin={() => navigate('/login')} />} />

        {/* Protected Routes */}
        <Route path="/user-setup" element={
          <ProtectedRoute user={user}>
            <UserSetupScreen user={user!} onSetupComplete={handleUserSetupComplete} onLogout={handleLogout} />
          </ProtectedRoute>
        } />

        <Route path="/" element={
          <ProtectedRoute user={user}>
            <AppLayout user={user} onLogout={handleLogout} onGoToPremiumPlans={() => navigate('/premium-plans')}>
              <ModeSelectionScreen
                userName={user?.name || ''}
                isAdmin={user?.isAdmin}
                user={user}
                onSelectPracticeMode={() => navigate('/knowledge-base')}
                onSelectTestMode={() => navigate('/tests')}
                onSelectQuickSearchMode={() => navigate('/quick-search')}
                onSelectPremiumMode={() => {
                  if (user && user.aiSearchQuota > 0) {
                    navigate('/live-camera');
                  } else {
                    navigate('/premium-intro');
                  }
                }}
                onGoToPremiumPlans={() => navigate('/premium-plans')}
                onAdminPanel={user?.isAdmin ? () => navigate('/admin') : undefined}
              />
            </AppLayout>
          </ProtectedRoute>
        } />

        <Route path="/tests" element={
          <ProtectedRoute user={user}>
            <AppLayout user={user} onLogout={handleLogout} onGoToPremiumPlans={() => navigate('/premium-plans')}>
              <TestListScreen
                user={user!}
                onAdminPanel={() => navigate('/admin')}
                onKnowledgeBase={() => navigate('/knowledge-base')}
                onStartTest={handleStartTest}
                onViewTestDetails={(testId) => navigate(`/tests/${testId}`)}
                onBack={() => navigate('/')}
              />
            </AppLayout>
          </ProtectedRoute>
        } />

        <Route path="/tests/:testId" element={
          <ProtectedRoute user={user}>
            <AppLayout user={user} onLogout={handleLogout} onGoToPremiumPlans={() => navigate('/premium-plans')}>
              <TestDetailWrapper user={user!} onBack={() => navigate('/tests')} />
            </AppLayout>
          </ProtectedRoute>
        } />

        <Route path="/tests/:testId/attempt/:attemptId" element={
          <ProtectedRoute user={user}>
            <AppLayout user={user} onLogout={handleLogout} onGoToPremiumPlans={() => navigate('/premium-plans')}>
              <AttemptDetailWrapper user={user!} />
            </AppLayout>
          </ProtectedRoute>
        } />

        <Route path="/knowledge-base" element={
          <ProtectedRoute user={user}>
            <AppLayout user={user} onLogout={handleLogout} onGoToPremiumPlans={() => navigate('/premium-plans')}>
              <KnowledgeBaseScreen
                bases={knowledgeBases}
                onSelect={handleSelectBase}
                onCreate={user?.isAdmin ? () => navigate('/upload') : undefined}
                onViewHistory={() => navigate('/history')}
                onCreateStudyPlan={handleCreateStudyPlanRequest}
                studyPlans={studyPlans}
                onViewStudyPlan={handleViewStudyPlan}
                isAdmin={user?.isAdmin}
                onBack={() => navigate('/')}
              />
            </AppLayout>
          </ProtectedRoute>
        } />

        <Route path="/upload" element={
          <ProtectedRoute user={user}>
            <AppLayout user={user} onLogout={handleLogout} onGoToPremiumPlans={() => navigate('/premium-plans')}>
              <FileUpload onSaveNewBase={handleSaveNewBase} onBack={() => navigate('/knowledge-base')} />
            </AppLayout>
          </ProtectedRoute>
        } />

        <Route path="/menu" element={
          <ProtectedRoute user={user}>
            <AppLayout user={user} onLogout={handleLogout} onGoToPremiumPlans={() => navigate('/premium-plans')}>
              <MainMenu onModeSelect={handleModeSelect} onReset={() => navigate('/knowledge-base')} />
            </AppLayout>
          </ProtectedRoute>
        } />

        <Route path="/setup" element={
          <ProtectedRoute user={user}>
            <AppLayout user={user} onLogout={handleLogout} onGoToPremiumPlans={() => navigate('/premium-plans')}>
              {quizMode ? (
                <SetupScreen mode={quizMode} allQuestions={allQuestions} onStartQuiz={handleStartQuiz} onBack={() => navigate('/')} />
              ) : <Navigate to="/" replace />}
            </AppLayout>
          </ProtectedRoute>
        } />

        <Route path="/quiz" element={
          <ProtectedRoute user={user}>
            <AppLayout user={user} onLogout={handleLogout} onGoToPremiumPlans={() => navigate('/premium-plans')}>
              {quizSettings && activeQuizQuestions.length > 0 && quizMode ? (
                <QuizScreen
                  questions={activeQuizQuestions}
                  settings={quizSettings}
                  mode={quizMode}
                  testName={currentTestInfo?.name}
                  maxAttempts={currentTestInfo?.maxAttempts}
                  currentAttempt={currentTestInfo?.currentAttempt}
                  onQuizComplete={handleQuizComplete}
                  onAnswerUpdate={handleAnswerUpdate}
                />
              ) : <Navigate to="/" replace />}
            </AppLayout>
          </ProtectedRoute>
        } />

        <Route path="/results" element={
          <ProtectedRoute user={user}>
            <AppLayout user={user} onLogout={handleLogout} onGoToPremiumPlans={() => navigate('/premium-plans')}>
              <ResultsScreen
                questions={activeQuizQuestions}
                userAnswers={userAnswers}
                attemptId={currentAttemptId}
                user={user}
                onRestart={() => navigate('/')}
              />
            </AppLayout>
          </ProtectedRoute>
        } />

        <Route path="/history" element={
          <ProtectedRoute user={user}>
            <AppLayout user={user} onLogout={handleLogout} onGoToPremiumPlans={() => navigate('/premium-plans')}>
              <QuizHistoryScreen attempts={quizAttempts} onBack={() => navigate('/')} />
            </AppLayout>
          </ProtectedRoute>
        } />

        <Route path="/admin" element={
          <ProtectedRoute user={user}>
            <AppLayout user={user} onLogout={handleLogout} onGoToPremiumPlans={() => navigate('/premium-plans')}>
              <AdminDashboard userEmail={user?.email || user?.username || ''} onBack={() => navigate('/')} knowledgeBases={knowledgeBases} />
            </AppLayout>
          </ProtectedRoute>
        } />

        <Route path="/study-plan/setup" element={
          <ProtectedRoute user={user}>
            <AppLayout user={user} onLogout={handleLogout} onGoToPremiumPlans={() => navigate('/premium-plans')}>
              {selectedKnowledgeBase ? (
                <StudyPlanSetupScreen
                  knowledgeBase={selectedKnowledgeBase}
                  onCreateStudyPlan={handleCreateStudyPlan}
                  onBack={() => navigate('/study-plan/list')}
                />
              ) : <Navigate to="/knowledge-base" replace />}
            </AppLayout>
          </ProtectedRoute>
        } />

        <Route path="/study-plan/list" element={
          <ProtectedRoute user={user}>
            <AppLayout user={user} onLogout={handleLogout} onGoToPremiumPlans={() => navigate('/premium-plans')}>
              {selectedKnowledgeBase ? (
                <StudyPlanListScreen
                  knowledgeBase={selectedKnowledgeBase}
                  studyPlans={studyPlans}
                  onCreateNew={() => navigate('/study-plan/setup')}
                  onSelectPlan={handleSelectStudyPlanFromList}
                  onEditPlan={handleSelectStudyPlanFromList}
                  onDeletePlan={handleDeleteStudyPlanFromList}
                  onBack={() => navigate('/knowledge-base')}
                />
              ) : <Navigate to="/knowledge-base" replace />}
            </AppLayout>
          </ProtectedRoute>
        } />

        <Route path="/study-plan/overview" element={
          <ProtectedRoute user={user}>
            <AppLayout user={user} onLogout={handleLogout} onGoToPremiumPlans={() => navigate('/premium-plans')}>
              {currentStudyPlan ? (
                <StudyPlanOverviewScreen
                  studyPlan={currentStudyPlan}
                  onStartDailyStudy={() => navigate('/study-plan/daily')}
                  onStartSmartReview={() => navigate('/study-plan/review')}
                  onStartPhase2={handleStartPhase2}
                  onDeleteStudyPlan={handleDeleteStudyPlan}
                  onUpdateStudyPlan={handleUpdateStudyPlan}
                  onBack={() => navigate('/study-plan/list')}
                />
              ) : <Navigate to="/knowledge-base" replace />}
            </AppLayout>
          </ProtectedRoute>
        } />

        <Route path="/study-plan/daily" element={
          <ProtectedRoute user={user}>
            <AppLayout user={user} onLogout={handleLogout} onGoToPremiumPlans={() => navigate('/premium-plans')}>
              {currentStudyPlan ? (
                <DailyStudy
                  studyPlan={currentStudyPlan}
                  currentUser={user?.email || user?.username || ''}
                  onBackToOverview={async () => {
                    await refreshStudyPlans();
                    navigate('/study-plan/overview');
                  }}
                />
              ) : <Navigate to="/knowledge-base" replace />}
            </AppLayout>
          </ProtectedRoute>
        } />

        <Route path="/study-plan/review" element={
          <ProtectedRoute user={user}>
            <AppLayout user={user} onLogout={handleLogout} onGoToPremiumPlans={() => navigate('/premium-plans')}>
              {currentStudyPlan ? (
                <SmartReview
                  studyPlan={currentStudyPlan}
                  currentUser={user?.email || user?.username || ''}
                  onBackToOverview={async () => {
                    await refreshStudyPlans();
                    navigate('/study-plan/overview');
                  }}
                />
              ) : <Navigate to="/knowledge-base" replace />}
            </AppLayout>
          </ProtectedRoute>
        } />

        <Route path="/quick-search" element={
          <ProtectedRoute user={user}>
            <AppLayout user={user} onLogout={handleLogout} onGoToPremiumPlans={() => navigate('/premium-plans')}>
              <QuickSearchScreen
                knowledgeBases={knowledgeBases}
                onBack={() => navigate('/')}
                user={user}
                onUpgradeRequired={() => navigate('/premium-plans')}
                onQuotaUpdate={refreshUserData}
              />
            </AppLayout>
          </ProtectedRoute>
        } />

        <Route path="/premium-intro" element={
          <ProtectedRoute user={user}>
            <AppLayout user={user} onLogout={handleLogout} onGoToPremiumPlans={() => navigate('/premium-plans')}>
              <PremiumIntroScreen
                onLiveCameraStart={() => navigate('/live-camera')}
                onBack={() => navigate('/')}
              />
            </AppLayout>
          </ProtectedRoute>
        } />

        <Route path="/live-camera" element={
          <ProtectedRoute user={user}>
            <AppLayout user={user} onLogout={handleLogout} onGoToPremiumPlans={() => navigate('/premium-plans')}>
              <LiveCameraSearch
                knowledgeBases={knowledgeBases}
                onBack={() => navigate('/')}
                onGoToPremiumPlans={() => navigate('/premium-plans')}
                user={user}
              />
            </AppLayout>
          </ProtectedRoute>
        } />

        <Route path="/premium-plans" element={
          <ProtectedRoute user={user}>
            <AppLayout user={user} onLogout={handleLogout} onGoToPremiumPlans={() => navigate('/premium-plans')}>
              <PremiumPlansScreen
                user={user}
                onBack={() => navigate('/')}
                onPurchaseSuccess={refreshUserData}
              />
            </AppLayout>
          </ProtectedRoute>
        } />

        {/* Fallback */}
        <Route path="*" element={<Navigate to={user ? "/" : "/login"} replace />} />
      </Routes>
    </>
  );
};

// Wrapper components for routes with params
const TestDetailWrapper: React.FC<{ user: User; onBack: () => void }> = ({ user, onBack }) => {
  const { testId } = useParams<{ testId: string }>();
  const navigate = useNavigate();

  if (!testId) return <Navigate to="/tests" replace />;

  return (
    <TestDetailScreen
      testId={testId}
      user={user}
      onBack={onBack}
      onViewAttemptDetails={(attemptId) => navigate(`/tests/${testId}/attempt/${attemptId}`)}
    />
  );
};

const AttemptDetailWrapper: React.FC<{ user: User }> = ({ user }) => {
  const { testId, attemptId } = useParams<{ testId: string; attemptId: string }>();
  const navigate = useNavigate();

  if (!attemptId || !testId) return <Navigate to="/tests" replace />;

  return (
    <AttemptDetailScreen
      attemptId={attemptId}
      user={user}
      onBack={() => navigate(`/tests/${testId}`)}
    />
  );
};

const AppWithRouter: React.FC = () => {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
};

export default AppWithRouter;
