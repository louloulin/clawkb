import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

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
    let startWeekday = firstDay.getDay() - 1;
    if (startWeekday < 0) startWeekday = 6;

    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const cells: Array<{ day: number; dateStr: string; isToday: boolean; hasNote: boolean } | null> = [];

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

  // Build heatmap grid (last 12 weeks ~ 84 days)
  const heatmapCells = useMemo(() => {
    const today = new Date();
    const cells: Array<{ dateStr: string; hasNote: boolean; isToday: boolean; isFuture: boolean }> = [];

    // Start from 11 weeks ago, aligned to Monday
    const endDate = new Date(today);
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 83); // 12 weeks
    // Align to Monday
    const dayOfWeek = startDate.getDay();
    const offset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    startDate.setDate(startDate.getDate() - offset);

    const d = new Date(startDate);
    while (d <= endDate) {
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      cells.push({
        dateStr,
        hasNote: dailySet.has(dateStr),
        isToday: dateStr === todayStr,
        isFuture: d > today,
      });
      d.setDate(d.getDate() + 1);
    }
    return cells;
  }, [dailySet]);

  const monthLabel = `${viewYear}年${viewMonth + 1}月`;
  const totalNotes = dailyDates.length;

  return (
    <div className="rounded-[1.25rem] border border-border bg-secondary p-3">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5" />
          日历
        </span>
        <div className="flex items-center gap-1">
          <button onClick={prevMonth} className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition">
            <ChevronLeft className="h-3 w-3" />
          </button>
          <button onClick={goToday} className="text-[11px] text-foreground/80 hover:text-foreground transition px-1">
            {monthLabel}
          </button>
          <button onClick={nextMonth} className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition">
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Heatmap — last ~12 weeks */}
      <div className="mb-3">
        <div className="flex items-center gap-1 mb-1">
          <span className="text-[9px] text-muted-foreground">{totalNotes} 篇日记</span>
          <div className="ml-auto flex items-center gap-0.5">
            <span className="text-[8px] text-muted-foreground/70">少</span>
            <div className="h-2.5 w-2.5 rounded-[2px] bg-secondary" />
            <div className="h-2.5 w-2.5 rounded-[2px] bg-amber-200/20" />
            <div className="h-2.5 w-2.5 rounded-[2px] bg-amber-200/40" />
            <div className="h-2.5 w-2.5 rounded-[2px] bg-amber-300/60" />
            <span className="text-[8px] text-muted-foreground/70">多</span>
          </div>
        </div>
        <div className="flex gap-[2px] overflow-hidden">
          {Array.from({ length: 12 }, (_, weekIdx) => (
            <div key={weekIdx} className="flex flex-col gap-[2px]">
              {Array.from({ length: 7 }, (_, dayIdx) => {
                const cellIdx = weekIdx * 7 + dayIdx;
                const cell = heatmapCells[cellIdx];
                if (!cell || cell.isFuture) {
                  return <div key={dayIdx} className="h-2.5 w-2.5 rounded-[2px]" />;
                }
                return (
                  <button
                    key={dayIdx}
                    onClick={() => onSelectDate(cell.dateStr)}
                    className={`h-2.5 w-2.5 rounded-[2px] transition hover:ring-1 hover:ring-amber-200/40 ${
                      cell.isToday
                        ? 'ring-1 ring-amber-300'
                        : cell.hasNote
                          ? 'bg-amber-200/40'
                          : 'bg-secondary hover:bg-muted'
                    }`}
                    title={`${cell.dateStr}${cell.hasNote ? ' ✦' : ''}`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map(w => (
          <div key={w} className="text-center text-[10px] text-muted-foreground py-0.5">{w}</div>
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
                    ? 'bg-amber-300 text-foreground font-semibold'
                    : cell.hasNote
                      ? 'bg-amber-200/15 text-amber-200 hover:bg-amber-200/25'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
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
