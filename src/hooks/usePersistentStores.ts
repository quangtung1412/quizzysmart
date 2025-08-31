import { useCallback, useEffect, useState } from 'react';
import { KnowledgeBase, QuizAttempt } from '../../types';
import { api } from '../api';

export function useKnowledgeBaseStore(userEmail: string | null) {
  const [bases, setBases] = useState<KnowledgeBase[]>([]);
  useEffect(() => {
    if (!userEmail) { setBases([]); return; }
    api.getBases(userEmail).then(data => setBases(data as KnowledgeBase[])).catch(() => setBases([]));
  }, [userEmail]);

  const addBase = useCallback(async (userEmail: string, base: Omit<KnowledgeBase, 'id' | 'createdAt'>) => {
    const created = await api.createBase(userEmail, base);
    const newBase: KnowledgeBase = {
      id: created.id,
      name: created.name,
      createdAt: created.createdAt,
      questions: created.questions.map((q: any) => ({
        id: q.id,
        question: q.question,
        options: q.options,
        correctAnswerIndex: q.correctAnswerIndex,
        source: q.source,
        category: q.category,
      }))
    };
    setBases(prev => [...prev, newBase]);
    return newBase;
  }, []);

  const removeBase = useCallback(async (id: string) => {
    await api.deleteBase(id);
    setBases(prev => prev.filter(b => b.id !== id));
  }, []);

  return { bases, addBase, removeBase, setBases };
}

export function useAttemptStore(userEmail: string | null) {
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  useEffect(() => {
    if (!userEmail) { setAttempts([]); return; }
    api.getAttempts(userEmail).then(data => setAttempts(data as QuizAttempt[])).catch(() => setAttempts([]));
  }, [userEmail]);

  const createAttempt = useCallback(async (userEmail: string, attempt: Omit<QuizAttempt, 'id'>) => {
  const resp: { id: string } = await api.createAttempt(userEmail, attempt);
  const newAttempt: QuizAttempt = { ...attempt, id: resp.id };
    setAttempts(prev => [...prev, newAttempt]);
    return newAttempt;
  }, []);

  const updateAttempt = useCallback(async (id: string, patch: Partial<QuizAttempt>) => {
    // Send only fields server expects
    const payload: any = {};
    if (patch.userAnswers) payload.userAnswers = patch.userAnswers.map(a => ({ questionId: a.questionId, selectedOptionIndex: a.selectedOptionIndex, isCorrect: a.isCorrect }));
    if (patch.score !== undefined) payload.score = patch.score;
    if (patch.completedAt !== undefined) payload.completedAt = patch.completedAt;
    await api.updateAttempt(id, payload);
    setAttempts(prev => prev.map(a => a.id === id ? { ...a, ...patch } as QuizAttempt : a));
  }, []);

  return { attempts, createAttempt, updateAttempt, setAttempts };
}
