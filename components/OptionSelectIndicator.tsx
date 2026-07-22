import React from 'react';

interface OptionSelectIndicatorProps {
  index: number;
  isMulti: boolean;
  selected?: boolean;
  size?: 'sm' | 'md';
}

/** Radio (single) or checkbox (multi) marker beside an answer option. */
const OptionSelectIndicator: React.FC<OptionSelectIndicatorProps> = ({
  index,
  isMulti,
  selected = false,
  size = 'sm',
}) => {
  const box = size === 'md' ? 'h-6 w-6 sm:h-7 sm:w-7' : 'h-5 w-5 sm:h-6 sm:w-6';
  const letter = String.fromCharCode(65 + index);

  if (isMulti) {
    return (
      <span
        className={`flex-shrink-0 ${box} rounded border-2 flex items-center justify-center mr-2 sm:mr-3 transition-colors ${
          selected
            ? 'bg-sky-600 border-sky-600 text-white'
            : 'border-slate-400 bg-white text-slate-600'
        }`}
        aria-hidden
      >
        {selected ? (
          <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        ) : (
          <span className="font-bold text-xs sm:text-sm">{letter}</span>
        )}
      </span>
    );
  }

  return (
    <span
      className={`flex-shrink-0 ${box} rounded-full border-2 flex items-center justify-center mr-2 sm:mr-3 font-bold text-xs sm:text-sm transition-colors ${
        selected
          ? 'bg-sky-600 border-sky-600 text-white'
          : 'border-slate-400 text-slate-600'
      }`}
      aria-hidden
    >
      {letter}
    </span>
  );
};

export default OptionSelectIndicator;
