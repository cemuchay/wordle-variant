import React from 'react';

interface Props {
  currentDate: string;
  onDateChange: (date: string) => void;
}

export const DatePicker: React.FC<Props> = ({ currentDate, onDateChange }) => {
  return (
    <div className="flex flex-col items-center gap-2 p-4 bg-gray-800/50 rounded-lg border border-gray-700 mb-6">
      <label className="text-xs font-bold uppercase tracking-widest text-gray-400">
        Beta Testing: Time Travel
      </label>
      <input 
        type="date" 
        value={currentDate}
        onChange={(e) => onDateChange(e.target.value)}
        className="bg-gray-900 border border-gray-600 rounded px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-correct"
      />
    </div>
  );
};