import React, { useEffect, useState, useCallback } from 'react';
import { X, CheckCircle, XCircle, Star } from 'lucide-react';
import { StudyPlan, DifficultyLevel } from '../types';
import { useStudyPlanStore } from '../src/hooks/useStudyPlanStore';

export interface DailyStudyProps {
  studyPlan: StudyPlan;
  currentUser: string;
  onBackToMenu: () => void;
}

const DailyStudy: React.FC<DailyStudyProps> = ({ studyPlan: initialPlan, currentUser, onBackToMenu }) => {
  const { getTodayQuestions, updateQuestionProgress } = useStudyPlanStore(currentUser);
  const [plan, setPlan] = useState(initialPlan);
  const [questions, setQuestions] = useState<any[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [ratingMode, setRatingMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true); setError(null);
      const res = await getTodayQuestions(plan.id, 20);
      setQuestions(res.questions);
      setPlan(res.studyPlan);
      if (!res.questions.length) setError('Không có câu hỏi nào hôm nay.');
    } catch {
      setError('Lỗi tải câu hỏi.');
    } finally { setLoading(false); }
  }, [getTodayQuestions, plan.id]);

  useEffect(() => { load(); }, [load]);

  const q = questions[index];
  const isCorrect = q && selected === q.correct_answer_id;

  const handleSelect = (id: string) => { if (!revealed) setSelected(id); };
  const handleCheck = () => { if (selected) { setRevealed(true); setRatingMode(true); } };

  const handleRate = async (lvl: DifficultyLevel) => {
    if (!q) return;
    try { await updateQuestionProgress(plan.id, q.id, lvl); } catch {}
    if (index < questions.length - 1) {
      setIndex(i => i + 1); setSelected(null); setRevealed(false); setRatingMode(false);
    } else { onBackToMenu(); }
  };

  if (loading) return <div className="p-8 text-center">Đang tải...</div>;
  if (error) return <div className="p-8 text-center space-y-4"><p>{error}</p><button className="px-4 py-2 bg-blue-600 text-white rounded" onClick={onBackToMenu}>Trở về</button></div>;
  if (!q) return <div className="p-8 text-center">Không có câu hỏi.</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-4">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-lg p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBackToMenu} className="p-2 rounded hover:bg-gray-100"><X className="w-5 h-5" /></button>
            <div>
              <h1 className="font-bold text-xl">{plan.knowledgeBaseName}</h1>
              <p className="text-sm text-gray-500">Ôn luyện cá nhân hóa</p>
            </div>
          </div>
          <div className="text-sm text-gray-600">{index + 1} / {questions.length}</div>
        </div>

        <div>
          <h2 className="font-semibold text-lg mb-4">{q.question}</h2>
          <div className="space-y-3">
            {q.answers.map((a: any) => {
              const sel = selected === a.id;
              const correct = revealed && a.id === q.correct_answer_id;
              const wrongSel = revealed && sel && !correct;
              return (
                <button
                  key={a.id}
                  onClick={() => handleSelect(a.id)}
                  disabled={revealed}
                  className={'w-full text-left border rounded-lg px-4 py-3 flex justify-between items-center transition ' +
                    (correct ? 'border-green-500 bg-green-50 ' : '') +
                    (wrongSel ? 'border-red-500 bg-red-50 ' : '') +
                    (!revealed && sel ? 'border-blue-500 bg-blue-50 ' : '') +
                    (!revealed && !sel ? 'border-gray-200 hover:bg-gray-50 ' : '')}
                >
                  <span>{a.answer_text}</span>
                  {correct && <CheckCircle className="w-5 h-5 text-green-600" />}
                  {wrongSel && <XCircle className="w-5 h-5 text-red-600" />}
                </button>
              );
            })}
          </div>
        </div>

        {revealed && q.explanation && (
          <div className="p-4 bg-gray-50 rounded border text-sm text-gray-700"><strong>Giải thích:</strong> {q.explanation}</div>
        )}

        <div className="flex justify-between items-center">
          <div className="text-sm">{revealed ? (isCorrect ? <span className="text-green-600 font-medium">Chính xác!</span> : <span className="text-red-600 font-medium">Chưa đúng</span>) : 'Chọn đáp án của bạn'}</div>
          {!ratingMode && <button onClick={handleCheck} disabled={!selected} className={'px-5 py-2 rounded text-white font-medium ' + (!selected ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700')}>Kiểm tra</button>}
        </div>

        {ratingMode && (
          <div className="space-y-3">
            <div className="text-center mb-2">
              <Star className="w-10 h-10 text-yellow-500 mx-auto mb-2" />
              <p className="font-semibold">Độ khó câu hỏi này?</p>
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              <button onClick={() => handleRate(DifficultyLevel.Easy)} className="p-3 border-2 border-green-200 rounded hover:border-green-400">Dễ</button>
              <button onClick={() => handleRate(DifficultyLevel.Medium)} className="p-3 border-2 border-yellow-200 rounded hover:border-yellow-400">Trung bình</button>
              <button onClick={() => handleRate(DifficultyLevel.Hard)} className="p-3 border-2 border-red-200 rounded hover:border-red-400">Khó</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DailyStudy;
