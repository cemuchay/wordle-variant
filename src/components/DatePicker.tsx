import React from 'react';

interface Props {
  currentDate: string;
  onDateChange: (date: string) => void;
}

export const DatePicker: React.FC<Props> = ({ currentDate, onDateChange }) => {
  return (
    <div className="flex flex-col items-center gap-2 p-2 bg-gray-800/50 rounded-lg border border-gray-700 mb-2">
      <label className="text-xs font-bold uppercase tracking-widest text-gray-400">
        Beta Testing: Time Travel
      </label>
      <input
        type="date"
        value={currentDate}
        onChange={(e) => onDateChange(e.target.value)}
        className="bg-gray-800 text-white text-[10px] font-mono px-2 py-1 rounded border border-gray-700 cursor-pointer hover:border-gray-500 transition-colors"
      />
    </div>
  );
};