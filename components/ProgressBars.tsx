import React from 'react';
import { ProgressStats } from '../types';

interface ProgressBarsProps {
  data: ProgressStats;
  className?: string;
}

/**
 * Unified progress bars component for displaying study progress and mastery
 * Used in both SmartReview and StudyPlanOverviewScreen
 */
const ProgressBars: React.FC<ProgressBarsProps> = ({ data, className = "" }) => {
  const { total, reviewed, easy, medium, hard } = data;
  
  // Avoid division by zero
  const safeTotal = Math.max(total, 1);
  
  // Calculate percentages
  const progressPct = Math.round((reviewed / safeTotal) * 100);
  const easyPct = Math.round((easy / safeTotal) * 100);
  const mediumPct = Math.round((medium / safeTotal) * 100);
  const hardPct = Math.round((hard / safeTotal) * 100);
  
  return (
    <div className={`space-y-4 ${className}`}>
      {/* Study Progress Bar */}
      <div>
        <div className="flex justify-between text-xs font-medium text-gray-600 mb-1">
          <span>Tiến độ học tập</span>
          <span>Đã học {reviewed}/{total} ({progressPct}%)</span>
        </div>
        <div className="h-3 w-full bg-gray-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-blue-500 transition-all duration-300" 
            style={{ width: `${Math.min(progressPct, 100)}%` }} 
          />
        </div>
      </div>
      
      {/* Mastery Progress Bar */}
      <div>
        <div className="flex justify-between text-xs font-medium text-gray-600 mb-1">
          <span>Trình độ</span>
          <span>Dễ: {easy} | TB: {medium} | Khó: {hard}</span>
        </div>
        <div className="h-3 w-full bg-gray-200 rounded-full flex overflow-hidden">
          <div 
            className="h-full bg-green-500 transition-all duration-300" 
            style={{ width: `${easyPct}%` }} 
          />
          <div 
            className="h-full bg-yellow-500 transition-all duration-300" 
            style={{ width: `${mediumPct}%` }} 
          />
          <div 
            className="h-full bg-red-500 transition-all duration-300" 
            style={{ width: `${hardPct}%` }} 
          />
        </div>
      </div>
    </div>
  );
};

export default ProgressBars;
