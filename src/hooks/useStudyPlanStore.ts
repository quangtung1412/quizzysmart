import { useState, useEffect, useCallback } from 'react';
import { StudyPlan, StudyPhase, DifficultyLevel, QuestionProgress } from '../../types';
import { api } from '../api';

export const useStudyPlanStore = (userEmail: string | null) => {
  const [studyPlans, setStudyPlans] = useState<StudyPlan[]>([]);
  const [loading, setLoading] = useState(false);

  // Load study plans from API
  useEffect(() => {
    if (!userEmail) {
      setStudyPlans([]);
      return;
    }

    setLoading(true);
    api.getStudyPlans()
      .then((plans) => {
        // Transform API response to match frontend types
        const transformedPlans = plans.map((plan: any) => ({
          ...plan,
          completedQuestions: typeof plan.completedQuestions === 'string'
            ? JSON.parse(plan.completedQuestions || '[]')
            : plan.completedQuestions || []
        }));
        setStudyPlans(transformedPlans);
      })
      .catch((error) => {
        console.error('Error loading study plans:', error);
        setStudyPlans([]);
      })
      .finally(() => setLoading(false));
  }, [userEmail]);

  // Create a new study plan
  const createStudyPlan = useCallback(async (
    knowledgeBaseId: string,
    knowledgeBaseName: string,
    totalQuestions: number,
    totalDays: number,
    minutesPerDay: number
  ): Promise<StudyPlan> => {
    if (!userEmail) throw new Error('User email is required');

    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + totalDays - 1);

    const questionsPerDay = Math.ceil(totalQuestions / totalDays);

    const newPlan = await api.createStudyPlan({
      knowledgeBaseId,
      knowledgeBaseName,
      totalDays,
      minutesPerDay,
      questionsPerDay,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    });

    // Transform API response
    const transformedPlan = {
      ...newPlan,
      completedQuestions: typeof newPlan.completedQuestions === 'string'
        ? JSON.parse(newPlan.completedQuestions || '[]')
        : newPlan.completedQuestions || []
    };

    setStudyPlans(prev => [...prev, transformedPlan]);
    return transformedPlan;
  }, [userEmail]);

  // Update a study plan
  const updateStudyPlan = useCallback(async (planId: string, updates: Partial<StudyPlan>) => {
    const updatedPlan = await api.updateStudyPlan(planId, updates);

    // Transform API response
    const transformedPlan = {
      ...updatedPlan,
      completedQuestions: typeof updatedPlan.completedQuestions === 'string'
        ? JSON.parse(updatedPlan.completedQuestions || '[]')
        : updatedPlan.completedQuestions || []
    };

    setStudyPlans(prev => prev.map(plan =>
      plan.id === planId ? transformedPlan : plan
    ));
    return transformedPlan;
  }, []);

  // Update question progress
  const updateQuestionProgress = useCallback(async (
    planId: string,
    questionId: string,
    difficultyLevel: DifficultyLevel
  ) => {
    const response = await api.updateQuestionProgress(planId, {
      questionId,
      difficultyLevel
    });

    // Update local state with the response
    const updatedPlan = {
      ...response.studyPlan,
      completedQuestions: typeof response.studyPlan.completedQuestions === 'string'
        ? JSON.parse(response.studyPlan.completedQuestions || '[]')
        : response.studyPlan.completedQuestions || []
    };

    setStudyPlans(prev => prev.map(plan =>
      plan.id === planId ? updatedPlan : plan
    ));

    return response.questionProgress;
  }, []);

  // Get questions for today's study session
  const getTodayQuestions = useCallback(async (
    planId: string,
    maxQuestions: number = 10
  ) => {
    const response = await api.getTodayQuestions(planId, maxQuestions);

    // Update local study plan state with latest data from API
    const updatedPlan = {
      ...response.studyPlan,
      completedQuestions: typeof response.studyPlan.completedQuestions === 'string'
        ? JSON.parse(response.studyPlan.completedQuestions || '[]')
        : response.studyPlan.completedQuestions || []
    };

    setStudyPlans(prev => prev.map(plan =>
      plan.id === planId ? updatedPlan : plan
    ));

    return {
      questions: response.questions,
      studyPlan: updatedPlan
    };
  }, []);

  // Get all hard questions for intensive study
  const getAllHardQuestions = useCallback(async (planId: string) => {
    const response = await api.getAllHardQuestions(planId);

    // Update local study plan state with latest data from API
    const updatedPlan = {
      ...response.studyPlan,
      completedQuestions: typeof response.studyPlan.completedQuestions === 'string'
        ? JSON.parse(response.studyPlan.completedQuestions || '[]')
        : response.studyPlan.completedQuestions || []
    };

    setStudyPlans(prev => prev.map(plan =>
      plan.id === planId ? updatedPlan : plan
    ));

    return {
      questions: response.questions,
      studyPlan: updatedPlan
    };
  }, []);

  // Delete a study plan
  const deleteStudyPlan = useCallback(async (planId: string) => {
    await api.deleteStudyPlan(planId);
    setStudyPlans(prev => prev.filter(plan => plan.id !== planId));
  }, []);

  // Get study plan by knowledge base ID
  const getStudyPlanByKnowledgeBaseId = useCallback((knowledgeBaseId: string) => {
    return studyPlans.find(plan => plan.knowledgeBaseId === knowledgeBaseId);
  }, [studyPlans]);

  return {
    studyPlans,
    loading,
    createStudyPlan,
    updateStudyPlan,
    updateQuestionProgress,
    getTodayQuestions,
    getAllHardQuestions,
    deleteStudyPlan,
    getStudyPlanByKnowledgeBaseId
  };
};
