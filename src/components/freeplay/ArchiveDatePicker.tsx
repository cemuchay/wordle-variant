// src/components/freeplay/ArchiveDatePicker.tsx

import { Calendar as CalendarIcon, CheckCircle2, ChevronLeft, ChevronRight, Filter, Shuffle, Sparkles, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { FIRST_ARCHIVE_DATE, getAllValidArchiveDates, getYesterdayArchiveDate } from '../../utils/archiveDb';
import { ModalLayout } from '../layout/ModalLayout';

interface ArchiveDatePickerProps {
  selectedDate: string;
  onSelectDate: (date: string) => void;
  completedDates: Set<string>;
  onClose: () => void;
  onShuffleUnplayed: () => void;
}

type FilterMode = 'all' | 'unplayed' | 'completed';

const formatDateDDMMYYYY = (isoDateStr: string): string => {
  if (!isoDateStr || typeof isoDateStr !== 'string') return isoDateStr;
  const parts = isoDateStr.split('-');
  if (parts.length === 3) {
    const [yyyy, mm, dd] = parts;
    return `${dd}-${mm}-${yyyy}`;
  }
  return isoDateStr;
};

export const ArchiveDatePicker = ({
  selectedDate,
  onSelectDate,
  completedDates,
  onClose,
  onShuffleUnplayed,
}: ArchiveDatePickerProps) => {
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const allValidDates = useMemo(() => getAllValidArchiveDates(), []);
  const yesterday = getYesterdayArchiveDate();

  // Current view month & year (defaults to the selectedDate's month/year or latest month)
  const [currentYearMonth, setCurrentYearMonth] = useState<{ year: number; month: number }>(() => {
    const d = new Date(selectedDate || yesterday);
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  // Calculate statistics
  const totalCount = allValidDates.length;
  const completedCount = useMemo(() => {
    return allValidDates.filter((d) => completedDates.has(d)).length;
  }, [allValidDates, completedDates]);
  const unplayedCount = totalCount - completedCount;

  // Filter dates according to selected tab filter mode
  const filteredDates = useMemo(() => {
    return allValidDates.filter((dateStr) => {
      const isCompleted = completedDates.has(dateStr);
      if (filterMode === 'completed') return isCompleted;
      if (filterMode === 'unplayed') return !isCompleted;
      return true;
    });
  }, [allValidDates, completedDates, filterMode]);

  // Handle month navigation
  const handlePrevMonth = () => {
    setCurrentYearMonth((prev) => {
      if (prev.month === 0) {
        return { year: prev.year - 1, month: 11 };
      }
      return { ...prev, month: prev.month - 1 };
    });
  };

  const handleNextMonth = () => {
    setCurrentYearMonth((prev) => {
      if (prev.month === 11) {
        return { year: prev.year + 1, month: 0 };
      }
      return { ...prev, month: prev.month + 1 };
    });
  };

  // Format month name header
  const monthName = new Date(currentYearMonth.year, currentYearMonth.month, 1).toLocaleString('default', {
    month: 'long',
    year: 'numeric',
  });

  // Filter dates matching current month in calendar view
  const currentMonthDates = useMemo(() => {
    const prefix = `${currentYearMonth.year}-${String(currentYearMonth.month + 1).padStart(2, '0')}`;
    return filteredDates.filter((d) => d.startsWith(prefix));
  }, [filteredDates, currentYearMonth]);

  return (
    <ModalLayout
      isOpen={true}
      onClose={onClose}
      showCloseButton={false}
      isOverlay={true}
      zIndex="z-160"
      maxWidth="md"
      containerClassName="p-0!"
    >
      <div className="flex flex-col h-full w-full bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4 text-white overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/20 border border-indigo-500/30 rounded-xl text-indigo-400">
              <CalendarIcon size={20} />
            </div>
            <div>
              <h2 className="text-base font-black uppercase tracking-wider text-white">Select Archive Date</h2>
              <p className="text-[11px] font-semibold text-gray-400">
                {completedCount} of {totalCount} Archives Completed
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-full hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Action Bar: Shuffle Button & Filter Tabs */}
        <div className="flex flex-col gap-3 shrink-0">
          <button
            onClick={() => {
              onShuffleUnplayed();
              onClose();
            }}
            className="w-full bg-linear-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white py-2.5 px-4 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 transition-all active:scale-98 cursor-pointer"
          >
            <Shuffle size={16} className="animate-spin-slow" />
            Shuffle Random Unplayed Date ({unplayedCount} Left)
          </button>

          {/* Filter Mode Selector */}
          <div className="grid grid-cols-3 gap-1 bg-slate-950/80 p-1.5 rounded-2xl border border-white/5">
            <button
              onClick={() => setFilterMode('all')}
              className={`py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer ${filterMode === 'all'
                  ? 'bg-slate-800 text-white shadow-md border border-white/10'
                  : 'text-gray-400 hover:text-white'
                }`}
            >
              All ({totalCount})
            </button>
            <button
              onClick={() => setFilterMode('unplayed')}
              className={`py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer ${filterMode === 'unplayed'
                  ? 'bg-indigo-600 text-white shadow-md border border-indigo-400/30'
                  : 'text-gray-400 hover:text-indigo-300'
                }`}
            >
              Unplayed ({unplayedCount})
            </button>
            <button
              onClick={() => setFilterMode('completed')}
              className={`py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer ${filterMode === 'completed'
                  ? 'bg-emerald-600 text-white shadow-md border border-emerald-400/30'
                  : 'text-gray-400 hover:text-emerald-300'
                }`}
            >
              Completed ({completedCount})
            </button>
          </div>
        </div>

        {/* Month Navigation */}
        <div className="flex items-center justify-between bg-slate-950/60 px-3 py-2 rounded-2xl border border-white/5 shrink-0">
          <button
            onClick={handlePrevMonth}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
            title="Previous Month"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-xs font-black uppercase tracking-widest text-indigo-300">{monthName}</span>
          <button
            onClick={handleNextMonth}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
            title="Next Month"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Dates Grid View */}
        <div className="flex-1 overflow-y-auto scrollbar-hide space-y-2 pr-1 min-h-55">
          {currentMonthDates.length === 0 ? (
            <div className="py-12 text-center text-gray-500 text-xs font-semibold space-y-1">
              <Filter size={24} className="mx-auto text-gray-600 mb-2 opacity-60" />
              <p>No {filterMode} puzzles found for this month.</p>
              <p className="text-[10px] text-gray-600">Try navigating months or changing filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {currentMonthDates.map((dateStr) => {
                const isCompleted = completedDates.has(dateStr);
                const isSelected = dateStr === selectedDate;
                const dateObj = new Date(dateStr);
                const dayNum = dateObj.getDate();
                const dayName = dateObj.toLocaleDateString('default', { weekday: 'short' });

                return (
                  <button
                    key={dateStr}
                    onClick={() => {
                      onSelectDate(dateStr);
                      onClose();
                    }}
                    className={`p-3 rounded-2xl border flex flex-col items-start justify-between gap-1.5 transition-all cursor-pointer relative overflow-hidden group ${isSelected
                        ? 'bg-indigo-600/90 border-indigo-400 text-white shadow-lg shadow-indigo-600/30 ring-2 ring-indigo-400/50'
                        : isCompleted
                          ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-100 hover:border-emerald-400 hover:bg-emerald-900/60'
                          : 'bg-slate-950/80 border-white/5 text-slate-200 hover:border-indigo-500/40 hover:bg-slate-800/80'
                      }`}
                  >
                    <div className="w-full flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 group-hover:text-white">
                        {dayName}
                      </span>
                      {isCompleted ? (
                        <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                      ) : (
                        <Sparkles size={12} className="text-indigo-400/60 shrink-0" />
                      )}
                    </div>

                    <div className="flex items-baseline gap-1.5">
                      <span className="text-lg font-black tracking-tight leading-none">{dayNum}</span>
                      <span className="text-[10px] font-bold text-gray-400">{formatDateDDMMYYYY(dateStr)}</span>
                    </div>

                    <div className="w-full text-[9px] font-extrabold uppercase tracking-wider">
                      {isCompleted ? (
                        <span className="text-emerald-400">Solved ✅</span>
                      ) : (
                        <span className="text-indigo-300">Play Puzzle 🎯</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="border-t border-white/10 pt-2.5 text-center">
          <p className="text-[10px] text-gray-500 font-semibold">
            Allowed range: {formatDateDDMMYYYY(FIRST_ARCHIVE_DATE)} to {formatDateDDMMYYYY(yesterday)}
          </p>
        </div>
      </div>
    </ModalLayout>
  );
};
