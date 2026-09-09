import React, { useMemo } from 'react';
import { computeDiffTokens } from '../../src/utils/textDiff';

interface DiffHighlighterProps {
  extractedText: string;
  referenceText?: string;
  className?: string;
  matchClassName?: string;
}

export const DiffHighlighter: React.FC<DiffHighlighterProps> = ({
  extractedText,
  referenceText,
  className = '',
  matchClassName = '',
}) => {
  const tokens = useMemo(() => {
    if (!referenceText) {
      return [{ text: extractedText, status: 'match' as const }];
    }
    return computeDiffTokens(extractedText, referenceText);
  }, [extractedText, referenceText]);

  return (
    <span className={`inline-block ${className}`}>
      {tokens.map((token, idx) => {
        if (token.status === 'match') {
          return (
            <span key={idx} className={matchClassName}>
              {token.text}
            </span>
          );
        }

        if (token.status === 'partial') {
          return (
            <span
              key={idx}
              className="bg-amber-100 text-amber-900 border border-amber-300 font-semibold px-1 py-0.5 rounded text-[0.95em] mx-0.5 transition-colors"
              title={token.refText ? `Gốc trong đề: "${token.refText}"` : 'Khác biệt nhẹ'}
            >
              {token.text}
            </span>
          );
        }

        // Mismatch
        return (
          <span
            key={idx}
            className="bg-red-100 text-red-900 border border-red-300 font-bold px-1 py-0.5 rounded text-[0.95em] mx-0.5 underline decoration-red-400 decoration-2 transition-colors"
            title={token.refText ? `Gốc trong đề: "${token.refText}"` : 'Khác biệt lớn/Số liệu lệch'}
          >
            {token.text}
          </span>
        );
      })}
    </span>
  );
};

export const DiffLegend: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`flex items-center gap-3 text-xs flex-wrap ${className}`}>
      <span className="font-semibold text-gray-700">Chú thích so khớp:</span>
      <span className="inline-flex items-center gap-1 text-gray-700">
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
        Khớp chuẩn
      </span>
      <span className="inline-flex items-center gap-1 text-amber-800">
        <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block"></span>
        Khác biệt nhẹ (Vàng)
      </span>
      <span className="inline-flex items-center gap-1 text-red-800">
        <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block"></span>
        Sai lệch/Số liệu khác (Đỏ)
      </span>
    </div>
  );
};

export default DiffHighlighter;
