import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

interface DailyCalendarProps {
  dailyDates: string[];
  onSelectDate: (dateStr: string) => void;
}

export function DailyCalendar({ dailyDates, onSelectDate }: DailyCalendarProps) {
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());

  const dailySet = useMemo(() => new Set(dailyDates), [dailyDates]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else { setViewMonth(m => m - 1); }
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else { setViewMonth(m => m + 1); }
  };

  const goToday = () => {
    const now = new Date();
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
  };

  // Build calendar grid
  const days = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    let startWeekday = firstDay.getDay() - 1; // Monday = 0
    if (startWeekday < 0) startWeekday = 6;

    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const cells: Array<{ day: number; dateStr: string; isToday: boolean; hasNote: boolean } | null> = [];

    // Empty cells before first day
    for (let i = 0; i < startWeekday; i++) {
      cells.push(null);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({
        day: d,
        dateStr,
        isToday: dateStr === todayStr,
        hasNote: dailySet.has(dateStr),
      });
    }

    return cells;
  }, [viewYear, viewMonth, dailySet]);

  const monthLabel = `${viewYear}年${viewMonth + 1}月`;

  return (
    <div className="rounded-[1.25rem] border border-white/10 bg-black/20 p-3">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] uppercase tracking-[0.18em] text-slate-400 flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5" />
          日历
        </span>
        <div className="flex items-center gap-1">
          <button onClick={prevMonth} className="h-6 w-6 flex items-center justify-center rounded-md text-slate-400 hover:text-white hover:bg-white/6 transition">
            <ChevronLeft className="h-3 w-3" />
          </button>
          <button onClick={goToday} className="text-[11px] text-slate-300 hover:text-white transition px-1">
            {monthLabel}
          </button>
          <button onClick={nextMonth} className="h-6 w-6 flex items-center justify-center rounded-md text-slate-400 hover:text-white hover:bg-white/6 transition">
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map(w => (
          <div key={w} className="text-center text-[10px] text-slate-500 py-0.5">{w}</div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((cell, i) => (
          <div key={i} className="flex items-center justify-center h-7">
            {cell ? (
              <button
                onClick={() => onSelectDate(cell.dateStr)}
                className={`h-6 w-6 flex items-center justify-center rounded-md text-[11px] transition ${
                  cell.isToday
                    ? 'bg-amber-300 text-slate-950 font-semibold'
                    : cell.hasNote
                      ? 'bg-amber-200/15 text-amber-200 hover:bg-amber-200/25'
                      : 'text-slate-400 hover:text-white hover:bg-white/6'
                }`}
                title={cell.hasNote ? `查看 ${cell.dateStr} 日记` : `创建 ${cell.dateStr} 日记`}
              >
                {cell.day}
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
