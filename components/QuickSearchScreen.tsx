import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { KnowledgeBase, Question } from '../types';
import { api } from '../src/api';

interface QuickSearchScreenProps {
  knowledgeBases: KnowledgeBase[];
  onBack: () => void;
}

interface SearchResult {
  question: Question;
  matchedInQuestion: boolean;
  matchedInAnswers: number[]; // indices of options that match
}

// Custom hook for debouncing
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

const QuickSearchScreen: React.FC<QuickSearchScreenProps> = ({ knowledgeBases, onBack }) => {
  const [selectedBaseIds, setSelectedBaseIds] = useState<Set<string>>(new Set());
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [isKnowledgeBaseExpanded, setIsKnowledgeBaseExpanded] = useState(true);
  const [visibleResults, setVisibleResults] = useState(50); // Show first 50 results

  // Debounce search keyword to avoid lag
  const debouncedSearchKeyword = useDebounce(searchKeyword, 300);

  // Toggle knowledge base selection
  const toggleBaseSelection = (baseId: string) => {
    setSelectedBaseIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(baseId)) {
        newSet.delete(baseId);
      } else {
        newSet.add(baseId);
      }
      return newSet;
    });
  };

  // Load questions from selected knowledge bases
  const loadQuestions = async () => {
    if (selectedBaseIds.size === 0) {
      setAllQuestions([]);
      return;
    }

    setIsLoadingQuestions(true);
    try {
      const baseIdsArray: string[] = Array.from(selectedBaseIds);
      const questions = await api.getQuickSearchQuestions(baseIdsArray);
      setAllQuestions(questions);
    } catch (error) {
      console.error('Failed to load questions:', error);
      alert('Không thể tải câu hỏi. Vui lòng thử lại.');
      setAllQuestions([]);
    } finally {
      setIsLoadingQuestions(false);
    }
  };

  // Load questions when selection changes
  useEffect(() => {
    loadQuestions();
    // Auto-collapse knowledge base selection after selecting at least one
    if (selectedBaseIds.size > 0) {
      setIsKnowledgeBaseExpanded(false);
    }
  }, [selectedBaseIds]);

  // Reset visible results when search keyword changes
  useEffect(() => {
    setVisibleResults(50);
  }, [debouncedSearchKeyword]);

  // Highlight text matching keyword - Optimized version
  const highlightText = useCallback((text: string, keyword: string): React.ReactNode => {
    if (!keyword.trim()) return text;

    const normalizedText = text.toLowerCase();
    const normalizedKeyword = keyword.toLowerCase().trim();

    // Quick check if keyword exists
    if (!normalizedText.includes(normalizedKeyword)) return text;

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let currentIndex = normalizedText.indexOf(normalizedKeyword);

    // Limit to first 50 matches to avoid performance issues with too many highlights
    let matchCount = 0;
    const MAX_MATCHES = 50;

    while (currentIndex !== -1 && matchCount < MAX_MATCHES) {
      // Add text before match
      if (currentIndex > lastIndex) {
        parts.push(text.substring(lastIndex, currentIndex));
      }

      // Add highlighted match
      parts.push(
        <mark key={`${currentIndex}-${matchCount}`} className="bg-yellow-200 font-semibold px-1 rounded">
          {text.substring(currentIndex, currentIndex + keyword.length)}
        </mark>
      );

      lastIndex = currentIndex + keyword.length;
      currentIndex = normalizedText.indexOf(normalizedKeyword, lastIndex);
      matchCount++;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return <>{parts}</>;
  }, []);

  // Filter and search questions - Use debounced keyword
  const searchResults = useMemo((): SearchResult[] => {
    const keyword = debouncedSearchKeyword.trim();

    if (!keyword) return [];
    if (allQuestions.length === 0) return [];

    const normalizedKeyword = keyword.toLowerCase();
    const results: SearchResult[] = [];

    // Limit results to improve performance
    const MAX_RESULTS = 500;

    for (const question of allQuestions) {
      if (results.length >= MAX_RESULTS) break;

      const matchedInQuestion = question.question.toLowerCase().includes(normalizedKeyword);
      const matchedInAnswers: number[] = [];

      question.options.forEach((option, index) => {
        if (option.toLowerCase().includes(normalizedKeyword)) {
          matchedInAnswers.push(index);
        }
      });

      if (matchedInQuestion || matchedInAnswers.length > 0) {
        results.push({
          question,
          matchedInQuestion,
          matchedInAnswers
        });
      }
    }

    return results;
  }, [allQuestions, debouncedSearchKeyword]);

  // Load more results function - defined after searchResults
  const loadMoreResults = useCallback(() => {
    setVisibleResults(prev => Math.min(prev + 50, searchResults.length));
  }, [searchResults.length]);

  // Get visible slice of results for performance
  const visibleSearchResults = useMemo(() => {
    return searchResults.slice(0, visibleResults);
  }, [searchResults, visibleResults]);

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {/* Header - Compact when knowledge base is selected */}
      <div className={`flex items-center justify-between transition-all duration-300 ${selectedBaseIds.size > 0 ? 'mb-2' : 'mb-6'}`}>
        <div>
          <h2 className={`font-bold text-slate-700 transition-all duration-300 ${selectedBaseIds.size > 0 ? 'text-2xl' : 'text-3xl'}`}>
            Tra cứu nhanh
          </h2>
          {selectedBaseIds.size === 0 && (
            <p className="text-slate-600 mt-1">Tìm kiếm câu hỏi và đáp án trong cơ sở kiến thức</p>
          )}
        </div>
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span>Quay lại</span>
        </button>
      </div>

      {/* Knowledge Base Selection */}
      <div className="bg-white rounded-xl shadow-md border border-slate-200">
        {/* Header - Always Visible */}
        <div
          className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors rounded-t-xl"
          onClick={() => setIsKnowledgeBaseExpanded(!isKnowledgeBaseExpanded)}
        >
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-slate-700">
              Cơ sở kiến thức
            </h3>
            {selectedBaseIds.size > 0 && (
              <span className="px-3 py-1 bg-purple-100 text-purple-700 text-sm font-semibold rounded-full">
                Đã chọn {selectedBaseIds.size} CSKT • {allQuestions.length} câu hỏi
              </span>
            )}
          </div>
          <button
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            title={isKnowledgeBaseExpanded ? "Thu gọn" : "Mở rộng"}
            aria-label={isKnowledgeBaseExpanded ? "Thu gọn" : "Mở rộng"}
          >
            <svg
              className={`w-5 h-5 text-slate-600 transition-transform duration-200 ${isKnowledgeBaseExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* Expandable Content */}
        {isKnowledgeBaseExpanded && (
          <div className="p-6 pt-0 border-t border-slate-100">
            {knowledgeBases.length === 0 ? (
              <p className="text-slate-500 text-center py-8">
                Chưa có cơ sở kiến thức nào. Vui lòng tạo hoặc tải lên cơ sở kiến thức trước.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {knowledgeBases.map(base => (
                  <button
                    key={base.id}
                    onClick={() => toggleBaseSelection(base.id)}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${selectedBaseIds.has(base.id)
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center ${selectedBaseIds.has(base.id)
                          ? 'border-purple-500 bg-purple-500'
                          : 'border-slate-300'
                        }`}>
                        {selectedBaseIds.has(base.id) && (
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-slate-700 truncate">{base.name}</h4>
                        <p className="text-sm text-slate-500 mt-1">
                          {base.questions.length} câu hỏi
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Search Box */}
      {selectedBaseIds.size > 0 && (
        <div className="sticky top-0 z-20 bg-slate-50 pb-3 -mx-4 px-4 pt-1">
          <div className="bg-white p-4 rounded-xl shadow-md border border-slate-200">
            <div className="relative">
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="Nhập từ khóa để tìm kiếm..."
                disabled={isLoadingQuestions}
                className="w-full px-5 py-3 pr-12 text-base border-2 border-slate-300 rounded-xl focus:border-purple-500 focus:outline-none transition-colors disabled:bg-slate-100 disabled:cursor-not-allowed"
              />
              {searchKeyword !== debouncedSearchKeyword ? (
                <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-500"></div>
                </div>
              ) : (
                <svg
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 w-6 h-6 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              )}
            </div>

            {isLoadingQuestions && (
              <div className="mt-3 text-center text-slate-500">
                <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500"></div>
                <p className="mt-2 text-sm">Đang tải câu hỏi...</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Search Results */}
      {!isLoadingQuestions && debouncedSearchKeyword.trim() && (
        <div className="bg-white rounded-xl shadow-md border border-slate-200">
          <div className="sticky top-0 bg-white p-4 border-b border-slate-200 rounded-t-xl z-10 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-700">
              Kết quả tìm kiếm
            </h3>
            <span className="text-sm text-slate-500">
              <strong className="text-purple-600">{searchResults.length}</strong> kết quả
              {searchResults.length >= 500 && <span className="text-xs ml-1">(giới hạn 500)</span>}
            </span>
          </div>

          {searchResults.length === 0 ? (
            <div className="text-center py-12 px-4">
              <svg className="mx-auto h-16 w-16 text-slate-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-slate-500 text-lg">Không tìm thấy kết quả nào</p>
              <p className="text-slate-400 text-sm mt-2">Thử tìm kiếm với từ khóa khác</p>
            </div>
          ) : (
            <>
              <div className="p-4 space-y-3 max-h-[calc(100vh-280px)] overflow-y-auto">
                {visibleSearchResults.map((result, index) => (
                  <div
                    key={result.question.id}
                    className="p-4 border border-slate-200 rounded-lg hover:shadow-md transition-shadow bg-slate-50"
                  >
                    {/* Question Number and Category */}
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <span className="flex items-center justify-center w-7 h-7 bg-purple-500 text-white rounded-full text-sm font-bold shrink-0">
                        {index + 1}
                      </span>
                      {result.question.category && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                          {result.question.category}
                        </span>
                      )}
                      {result.question.source && (
                        <span className="px-2 py-1 bg-slate-200 text-slate-600 text-xs rounded-full">
                          {result.question.source}
                        </span>
                      )}
                    </div>

                    {/* Question Text */}
                    <div className="mb-3">
                      <p className="text-slate-800 leading-relaxed">
                        {highlightText(result.question.question, debouncedSearchKeyword)}
                      </p>
                    </div>

                    {/* Answer Options - Compact */}
                    <div className="space-y-1.5">
                      {result.question.options.map((option, optionIndex) => {
                        const isCorrect = optionIndex === result.question.correctAnswerIndex;

                        return (
                          <div
                            key={optionIndex}
                            className={`p-2 rounded-lg border ${isCorrect
                                ? 'border-green-500 bg-green-50'
                                : 'border-slate-200 bg-white'
                              }`}
                          >
                            <div className="flex items-start gap-2">
                              <span className={`mt-0.5 flex items-center justify-center w-5 h-5 rounded-full text-xs font-semibold shrink-0 ${isCorrect
                                  ? 'bg-green-500 text-white'
                                  : 'bg-slate-200 text-slate-600'
                                }`}>
                                {String.fromCharCode(65 + optionIndex)}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm ${isCorrect ? 'text-green-900 font-medium' : 'text-slate-700'}`}>
                                  {highlightText(option, debouncedSearchKeyword)}
                                </p>
                                {isCorrect && (
                                  <span className="inline-flex items-center gap-1 mt-1 text-xs text-green-700 font-semibold">
                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                    Đáp án đúng
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Load More Button */}
              {visibleResults < searchResults.length && (
                <div className="p-4 text-center border-t border-slate-200">
                  <button
                    onClick={loadMoreResults}
                    className="px-6 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors font-medium"
                  >
                    Xem thêm ({searchResults.length - visibleResults} câu hỏi)
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Prompt when CSKT selected but no search keyword */}
      {selectedBaseIds.size > 0 && !debouncedSearchKeyword.trim() && !isLoadingQuestions && (
        <div className="bg-gradient-to-br from-purple-50 to-violet-50 border-2 border-purple-200 rounded-xl p-8 text-center">
          <svg className="mx-auto h-12 w-12 text-purple-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-lg font-semibold text-purple-800 mb-2">
            Sẵn sàng để tra cứu
          </h3>
          <p className="text-purple-600 mb-1">
            Đã tải <strong>{allQuestions.length}</strong> câu hỏi từ <strong>{selectedBaseIds.size}</strong> cơ sở kiến thức
          </p>
          <p className="text-purple-500 text-sm">
            Nhập từ khóa vào ô tìm kiếm phía trên để bắt đầu
          </p>
        </div>
      )}

      {/* Empty State - No Knowledge Base Selected */}
      {selectedBaseIds.size === 0 && (
        <>
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-8 text-center">
            <svg className="mx-auto h-16 w-16 text-purple-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <h3 className="text-lg font-semibold text-purple-800 mb-2">
              Hãy chọn cơ sở kiến thức để bắt đầu
            </h3>
            <p className="text-purple-600">
              Bạn có thể chọn một hoặc nhiều cơ sở kiến thức để tra cứu
            </p>
          </div>

          {/* Instructions */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-slate-700 mb-3">
              💡 Hướng dẫn sử dụng
            </h3>
            <ul className="space-y-2 text-slate-600">
              <li className="flex items-start gap-2">
                <span className="text-purple-500 font-bold">1.</span>
                <span>Chọn một hoặc nhiều cơ sở kiến thức bạn muốn tra cứu</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-500 font-bold">2.</span>
                <span>Nhập từ khóa vào ô tìm kiếm (có thể là từ trong câu hỏi hoặc câu trả lời)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-500 font-bold">3.</span>
                <span>Hệ thống sẽ hiển thị tất cả câu hỏi có chứa từ khóa, với từ khóa được đánh dấu màu vàng</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-500 font-bold">4.</span>
                <span>Đáp án đúng được đánh dấu màu xanh lá</span>
              </li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
};

export default QuickSearchScreen;
