import { QuestionProgress, DifficultyLevel, ProgressStats } from '../../types';

export const calculateStudyProgress = (questionProgress: QuestionProgress[]): ProgressStats => {
  const total = questionProgress.length;
  const reviewed = questionProgress.filter(q => q.lastReviewed !== null).length;
  const easy = questionProgress.filter(q => q.difficultyLevel === DifficultyLevel.Easy).length;
  const medium = questionProgress.filter(q => q.difficultyLevel === DifficultyLevel.Medium).length;
  const hard = questionProgress.filter(q => q.difficultyLevel === DifficultyLevel.Hard).length;
  const unrated = total - (easy + medium + hard);

  return { total, reviewed, easy, medium, hard, unrated };
};
