import React, { useState, useCallback, useEffect } from 'react';
import { Question, QuizMode, QuizSettings, UserAnswer, KnowledgeBase, QuizAttempt, User, StudyPlan, DifficultyLevel } from './types';
import { useKnowledgeBaseStore, useAttemptStore } from './src/hooks/usePersistentStores';
import { useStudyPlanStore } from './src/hooks/useStudyPlanStore';
import { shuffleArray } from './src/utils/shuffle';
import { api } from './src/api';
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


type Screen = 'login' | 'register' | 'userSetup' | 'modeSelection' | 'testList' | 'testDetail' | 'attemptDetail' | 'knowledgeBase' | 'upload' | 'menu' | 'setup' | 'quiz' | 'results' | 'history' | 'admin' | 'studyPlanSetup' | 'studyPlanOverview' | 'dailyStudy' | 'smartReview' | 'studyPlanList';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [currentScreen, setCurrentScreen] = useState<Screen>('login');

  // Prevent browser/Android back navigation (soft back) while in app
  useEffect(() => {
    const blockPop = (e: PopStateEvent) => {
      // Immediately push state again to neutralize back action
      history.pushState(null, document.title, window.location.href);
    };
    // Seed an extra history entry so first back is trapped
    history.pushState(null, document.title, window.location.href);
    window.addEventListener('popstate', blockPop);
    return () => window.removeEventListener('popstate', blockPop);
  }, []);

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

  // State for test detail view
  const [currentTestId, setCurrentTestId] = useState<string | null>(null);
  const [currentAttemptDetailId, setCurrentAttemptDetailId] = useState<string | null>(null);


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


  const handleLoginSuccess = useCallback((loggedInUser: User) => {
    setUser(loggedInUser);

    // Check if user needs to complete setup (missing branchCode)
    if (!loggedInUser.branchCode) {
      setCurrentScreen('userSetup');
    } else {
      setCurrentScreen('modeSelection');
    }
  }, []);

  const handleSwitchToRegister = useCallback(() => {
    setCurrentScreen('register');
  }, []);

  const handleSwitchToLogin = useCallback(() => {
    setCurrentScreen('login');
  }, []);

  const handleUserSetupComplete = useCallback((updatedUser: User) => {
    setUser(updatedUser);
    setCurrentScreen('modeSelection');
  }, []);

  useEffect(() => {
    api.me().then(r => {
      if (r.user) {
        const userData: User = {
          id: r.user.id,
          username: r.user.username,
          googleId: r.user.googleId,
          name: r.user.name || '',
          email: r.user.email,
          branchCode: r.user.branchCode,
          isAdmin: (r.user as any).role === 'admin',
          picture: r.user.picture || ''
        };
        setUser(userData);

        // Check if user needs to complete setup
        if (!userData.branchCode) {
          setCurrentScreen('userSetup');
        } else {
          setCurrentScreen('modeSelection');
        }
      }
    }).catch(() => { });
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await api.logout();
    } catch (error) {
      console.error('Logout error:', error);
    }

    setUser(null);
    setCurrentScreen('login');
    setKnowledgeBases([]);
    setAllQuestions([]);
    setQuizMode(null);
    setQuizSettings(null);
    setActiveQuizQuestions([]);
    setUserAnswers([]);
    setQuizAttempts([]);
    setSelectedKnowledgeBase(null);
    setCurrentAttemptId(null);
  }, []);

  const handleSelectPracticeMode = useCallback(() => {
    setCurrentScreen('knowledgeBase');
    setAllQuestions([]);
    setQuizMode(null);
    setSelectedKnowledgeBase(null);
  }, []);

  const handleSelectTestMode = useCallback(() => {
    setCurrentScreen('testList');
    setQuizMode(null);
    setQuizSettings(null);
    setActiveQuizQuestions([]);
    setUserAnswers([]);
    setCurrentAttemptId(null);
    setCurrentTestInfo(null);
    setCurrentTestId(null);
    setCurrentAttemptDetailId(null);
  }, []);

  const handleGoToKnowledgeBase = useCallback(() => {
    setCurrentScreen('knowledgeBase');
    setAllQuestions([]);
    setQuizMode(null);
    setSelectedKnowledgeBase(null);
  }, []);

  const handleGoToStudyPlanList = useCallback(() => {
    setCurrentScreen('studyPlanList');
    setCurrentStudyPlan(null);
  }, []);

  const handleGoToTestList = useCallback(() => {
    setCurrentScreen('testList');
    setQuizMode(null);
    setQuizSettings(null);
    setActiveQuizQuestions([]);
    setUserAnswers([]);
    setCurrentAttemptId(null); // Clear attempt ID when going back to test list
    setCurrentTestInfo(null);
    setCurrentTestId(null);
    setCurrentAttemptDetailId(null);
  }, []);

  const handleGoToModeSelection = useCallback(() => {
    setCurrentScreen('modeSelection');
    setQuizMode(null);
    setQuizSettings(null);
    setActiveQuizQuestions([]);
    setUserAnswers([]);
    setCurrentAttemptId(null);
    setCurrentTestInfo(null);
    setCurrentTestId(null);
    setCurrentAttemptDetailId(null);
    setAllQuestions([]);
    setSelectedKnowledgeBase(null);
  }, []);

  const handleGoToAdmin = useCallback(() => {
    setCurrentScreen('admin');
  }, []);

  const handleViewTestDetails = useCallback((testId: string) => {
    setCurrentTestId(testId);
    setCurrentScreen('testDetail');
  }, []);

  const handleViewAttemptDetails = useCallback((attemptId: string) => {
    setCurrentAttemptDetailId(attemptId);
    setCurrentScreen('attemptDetail');
  }, []);

  const handleBackToTestDetail = useCallback(() => {
    setCurrentScreen('testDetail');
    setCurrentAttemptDetailId(null);
  }, []);

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
        testId: testId, // For test attempts, we use testId instead of knowledgeBaseId
        knowledgeBaseName: testData.name,
        mode: QuizMode.Test, // New mode for tests
        settings: {
          questionCount: testData.questionCount,
          timeLimit: testData.timeLimit,
          categories: []
        },
        startedAt: new Date().toISOString(),
        completedAt: null,
        userAnswers: initialAnswers,
        score: null,
        isTest: true // Flag to identify this as a test attempt
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
      setCurrentScreen('quiz');

    } catch (error: any) {
      console.error('Failed to start test:', error);
      alert(`Không thể bắt đầu làm bài: ${error.message || 'Lỗi không xác định'}`);
    }
  }, [user, createAttempt]);

  const handleCreateNewRequest = useCallback(() => {
    setCurrentScreen('upload');
  }, []);

  const handleSaveNewBase = useCallback(async (name: string, questions: Question[]) => {
    if (!user) return;
    const userEmail = user.email || user.username || '';
    if (!userEmail) return;

    const created = await addBase(userEmail, { name, questions } as any);
    setAllQuestions(created.questions);
    setSelectedKnowledgeBase(created as any);
    setCurrentScreen('menu');
  }, [user, addBase]);

  const handleSelectBase = useCallback((baseId: string) => {
    const selectedBase = knowledgeBases.find(b => b.id === baseId);
    if (selectedBase) {
      setAllQuestions(selectedBase.questions);
      setSelectedKnowledgeBase(selectedBase);
      setCurrentScreen('menu');
    }
  }, [knowledgeBases]);

  const handleModeSelect = useCallback((mode: QuizMode) => {
    setQuizMode(mode);
    setCurrentScreen('setup');
  }, []);

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
    setCurrentScreen('quiz');
  }, [allQuestions, selectedKnowledgeBase, quizMode, user, createAttempt]);

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
        setCurrentScreen('results');
      } catch (error) {
        console.error('Failed to submit quiz:', error);
        alert('Có lỗi xảy ra khi nộp bài. Vui lòng thử lại.');
      }
    } else {
      // Fallback if no attempt ID
      setUserAnswers(finalAnswers);
      setCurrentScreen('results');
    }
  }, [currentAttemptId, updateAttempt]);

  const handleRestartQuiz = useCallback(() => {
    setCurrentScreen('modeSelection');
    setQuizMode(null);
    setQuizSettings(null);
    setActiveQuizQuestions([]);
    setUserAnswers([]);
    setCurrentAttemptId(null); // Clear attempt ID when restarting
    setCurrentTestInfo(null);
  }, []);

  const handleViewHistory = useCallback(() => setCurrentScreen('history'), []);

  // Study Plan Handlers
  const handleCreateStudyPlanRequest = useCallback((knowledgeBase: KnowledgeBase) => {
    setSelectedKnowledgeBase(knowledgeBase);
    setAllQuestions(knowledgeBase.questions);
    setCurrentScreen('studyPlanSetup');
  }, []);

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
      // Navigate to overview of the newly created study plan
      setCurrentScreen('studyPlanOverview');
    } catch (error) {
      console.error('Error creating study plan:', error);
      alert('Có lỗi xảy ra khi tạo lộ trình ôn tập. Vui lòng thử lại.');
    }
  }, [selectedKnowledgeBase, user, createStudyPlan]);

  const handleViewStudyPlan = useCallback((knowledgeBase: KnowledgeBase) => {
    // Navigate to list of study plans for this knowledge base
    setSelectedKnowledgeBase(knowledgeBase);
    setAllQuestions(knowledgeBase.questions);
    setCurrentScreen('studyPlanList');
  }, []);

  const handleSelectStudyPlanFromList = useCallback((plan: StudyPlan) => {
    setCurrentStudyPlan(plan);
    setCurrentScreen('studyPlanOverview');
  }, []);

  const handleCreateNewPlanFromList = useCallback(() => {
    if (!selectedKnowledgeBase) return;
    setCurrentScreen('studyPlanSetup');
  }, [selectedKnowledgeBase]);

  const handleEditStudyPlanFromList = useCallback((plan: StudyPlan) => {
    setCurrentStudyPlan(plan);
    // We'll create a new screen for editing later, for now use overview
    setCurrentScreen('studyPlanOverview');
  }, []);

  const handleDeleteStudyPlanFromList = useCallback(async (planId: string) => {
    await deleteStudyPlan(planId);
  }, [deleteStudyPlan]);

  const handleStartDailyStudy = useCallback(() => {
    if (!currentStudyPlan) return;
    setCurrentScreen('dailyStudy');
  }, [currentStudyPlan]);

  const handleStartSmartReview = useCallback(() => {
    if (!currentStudyPlan) return;
    setCurrentScreen('smartReview');
  }, [currentStudyPlan]);

  const handleBackToOverview = useCallback(async () => {
    // Refresh study plans from API when returning from SmartReview to ensure latest progress
    await refreshStudyPlans();
    setCurrentScreen('studyPlanOverview');
  }, [refreshStudyPlans]);

  // Update current study plan when studyPlans array changes
  useEffect(() => {
    if (currentStudyPlan && studyPlans.length > 0) {
      const refreshedPlan = studyPlans.find(plan => plan.id === currentStudyPlan.id);
      if (refreshedPlan && JSON.stringify(refreshedPlan) !== JSON.stringify(currentStudyPlan)) {
        setCurrentStudyPlan(refreshedPlan);
      }
    }
  }, [studyPlans, currentStudyPlan]);

  const handleQuestionComplete = useCallback((questionId: string, difficultyLevel: DifficultyLevel) => {
    if (!currentStudyPlan) return;

    updateQuestionProgress(currentStudyPlan.id, questionId, difficultyLevel);

    // Update current study plan state
    const updatedPlan = {
      ...currentStudyPlan,
      updatedAt: new Date().toISOString()
    };
    setCurrentStudyPlan(updatedPlan);
  }, [currentStudyPlan, updateQuestionProgress]);

  const handleStartPhase2 = useCallback(() => {
    if (!currentStudyPlan || !selectedKnowledgeBase) return;

    // Set up a comprehensive test with all questions
    const allQs = selectedKnowledgeBase.questions;
    const shuffled = shuffleArray([...allQs]) as Question[];

    setActiveQuizQuestions(shuffled);
    setQuizMode(QuizMode.Exam); // Use exam mode for phase 2
    setQuizSettings({
      questionCount: allQs.length,
      timeLimit: Math.max(allQs.length * 2, 30), // 2 minutes per question, minimum 30 minutes
      categories: []
    });
    setCurrentScreen('quiz');
  }, [currentStudyPlan, selectedKnowledgeBase]);

  const handleDeleteStudyPlan = useCallback(() => {
    if (!currentStudyPlan) return;

    deleteStudyPlan(currentStudyPlan.id);
    setCurrentStudyPlan(null);
    setCurrentScreen('knowledgeBase');
  }, [currentStudyPlan, deleteStudyPlan]);

  const handleUpdateStudyPlan = useCallback((updatedPlan: StudyPlan) => {
    updateStudyPlan(updatedPlan.id, updatedPlan);
    setCurrentStudyPlan(updatedPlan);
  }, [updateStudyPlan]);

  const renderScreen = () => {
    switch (currentScreen) {
      case 'login':
        return <LoginScreen onLoginSuccess={handleLoginSuccess} onSwitchToRegister={handleSwitchToRegister} />;
      case 'register':
        return <RegisterScreen onSwitchToLogin={handleSwitchToLogin} />;
      case 'userSetup':
        if (!user) return <LoginScreen onLoginSuccess={handleLoginSuccess} onSwitchToRegister={handleSwitchToRegister} />;
        return <UserSetupScreen user={user} onSetupComplete={handleUserSetupComplete} onLogout={handleLogout} />;
      case 'modeSelection':
        return <ModeSelectionScreen
          userName={user?.name || ''}
          onSelectPracticeMode={handleSelectPracticeMode}
          onSelectTestMode={handleSelectTestMode}
        />;
      case 'testList':
        return <TestListScreen
          user={user!}
          onAdminPanel={handleGoToAdmin}
          onKnowledgeBase={handleGoToKnowledgeBase}
          onStartTest={handleStartTest}
          onViewTestDetails={handleViewTestDetails}
          onBack={handleGoToModeSelection}
        />;
      case 'testDetail':
        if (!currentTestId) return <TestListScreen
          user={user!}
          onAdminPanel={handleGoToAdmin}
          onKnowledgeBase={handleGoToKnowledgeBase}
          onStartTest={handleStartTest}
          onViewTestDetails={handleViewTestDetails}
          onBack={handleGoToModeSelection}
        />;
        return <TestDetailScreen
          testId={currentTestId}
          user={user!}
          onBack={handleGoToTestList}
          onViewAttemptDetails={handleViewAttemptDetails}
        />;
      case 'attemptDetail':
        if (!currentAttemptDetailId) return handleBackToTestDetail();
        return <AttemptDetailScreen
          attemptId={currentAttemptDetailId}
          user={user!}
          onBack={handleBackToTestDetail}
        />;
      case 'knowledgeBase':
        return <KnowledgeBaseScreen
          bases={knowledgeBases}
          onSelect={handleSelectBase}
          onCreate={user?.isAdmin ? handleCreateNewRequest : undefined}
          onViewHistory={handleViewHistory}
          onCreateStudyPlan={handleCreateStudyPlanRequest}
          studyPlans={studyPlans}
          onViewStudyPlan={handleViewStudyPlan}
          isAdmin={user?.isAdmin}
          onBack={handleGoToModeSelection}
        />;
      case 'admin':
        const userEmail = user?.email || user?.username || '';
        return <AdminDashboard userEmail={userEmail} onBack={handleGoToModeSelection} knowledgeBases={knowledgeBases} />;
      case 'history':
        return <QuizHistoryScreen attempts={quizAttempts} onBack={handleGoToModeSelection} />;
      case 'upload':
        return <FileUpload onSaveNewBase={handleSaveNewBase} onBack={handleGoToKnowledgeBase} />;
      case 'menu':
        return <MainMenu onModeSelect={handleModeSelect} onReset={handleGoToKnowledgeBase} />;
      case 'setup':
        if (!quizMode) return null;
        return <SetupScreen mode={quizMode} allQuestions={allQuestions} onStartQuiz={handleStartQuiz} onBack={handleRestartQuiz} />;
      case 'quiz':
        if (!quizSettings || activeQuizQuestions.length === 0 || !quizMode) return null;
        return <QuizScreen
          questions={activeQuizQuestions}
          settings={quizSettings}
          mode={quizMode}
          testName={currentTestInfo?.name}
          maxAttempts={currentTestInfo?.maxAttempts}
          currentAttempt={currentTestInfo?.currentAttempt}
          onQuizComplete={handleQuizComplete}
          onAnswerUpdate={handleAnswerUpdate}
        />;
      case 'results':
        return <ResultsScreen
          questions={activeQuizQuestions}
          userAnswers={userAnswers}
          attemptId={currentAttemptId}
          user={user}
          onRestart={handleGoToModeSelection}
        />;
      case 'studyPlanSetup':
        if (!selectedKnowledgeBase) return handleGoToKnowledgeBase();
        return <StudyPlanSetupScreen
          knowledgeBase={selectedKnowledgeBase}
          onCreateStudyPlan={handleCreateStudyPlan}
          onBack={handleGoToStudyPlanList}
        />;
      case 'studyPlanOverview':
        if (!currentStudyPlan) return handleGoToKnowledgeBase();
        return <StudyPlanOverviewScreen
          studyPlan={currentStudyPlan}
          onStartDailyStudy={handleStartDailyStudy}
          onStartSmartReview={handleStartSmartReview}
          onStartPhase2={handleStartPhase2}
          onDeleteStudyPlan={handleDeleteStudyPlan}
          onUpdateStudyPlan={handleUpdateStudyPlan}
          onBack={handleGoToStudyPlanList}
        />;
      case 'studyPlanList':
        if (!selectedKnowledgeBase) return handleGoToKnowledgeBase();
        return <StudyPlanListScreen
          knowledgeBase={selectedKnowledgeBase}
          studyPlans={studyPlans}
          onCreateNew={handleCreateNewPlanFromList}
          onSelectPlan={handleSelectStudyPlanFromList}
          onEditPlan={handleEditStudyPlanFromList}
          onDeletePlan={handleDeleteStudyPlanFromList}
          onBack={handleGoToKnowledgeBase}
        />;
      case 'dailyStudy':
        if (!currentStudyPlan) return handleGoToKnowledgeBase();
        const dailyStudyEmail = user?.email || user?.username || '';
        return <DailyStudy
          studyPlan={currentStudyPlan}
          currentUser={dailyStudyEmail}
          onBackToOverview={handleBackToOverview}
        />;
      case 'smartReview':
        if (!currentStudyPlan) return handleGoToKnowledgeBase();
        const smartReviewEmail = user?.email || user?.username || '';
        return <SmartReview
          studyPlan={currentStudyPlan}
          currentUser={smartReviewEmail}
          onBackToOverview={handleBackToOverview}
        />;
      default:
        return <LoginScreen onLoginSuccess={handleLoginSuccess} onSwitchToRegister={handleSwitchToRegister} />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-50 text-slate-800">
      <div className="w-full max-w-8xl mx-auto relative">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-red-800 ">Quizzy Smart</h1>
          <p className="text-slate-500 mt-2">Ôn thi trắc nghiệm thông minh</p>
          {user && (
            <div className="absolute top-0 right-0 flex items-center gap-3 bg-white p-2 rounded-full shadow-sm border border-slate-200">
              {user.picture && <img src={user.picture} alt={user.name} className="w-8 h-8 rounded-full" />}
              <span className="text-sm font-medium text-slate-600 hidden sm:inline">Chào, {user.name}</span>
              <button
                onClick={handleLogout}
                title="Đăng xuất"
                className="p-2 text-slate-500 hover:bg-slate-100 hover:text-red-600 rounded-full transition-colors"
                aria-label="Đăng xuất"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          )}
        </header>
        <main className="bg-white p-6 sm:p-8 rounded-2xl shadow-lg transition-all duration-300">
          {renderScreen()}
        </main>
        <footer className="text-center mt-8 text-sm text-slate-400">
          <p>©2025 – Phạm Quang Tùng - Agribank Chi nhánh Hải Dương</p>
        </footer>
      </div>
    </div>
  );
};

export default App;
