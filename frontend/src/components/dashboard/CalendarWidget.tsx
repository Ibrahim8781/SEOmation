import { useMemo, useState } from 'react';
import dayjs, { Dayjs } from 'dayjs';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import './calendarWidget.css';

function buildCalendarMatrix(reference: Dayjs) {
  const startOfMonth = reference.startOf('month');
  const endOfMonth = reference.endOf('month');
  const startDate = startOfMonth.startOf('week');
  const endDate = endOfMonth.endOf('week');

  const matrix: Dayjs[][] = [];
  let current = startDate;

  while (current.isBefore(endDate) || current.isSame(endDate, 'day')) {
    const week: Dayjs[] = [];
    for (let i = 0; i < 7; i += 1) {
      week.push(current);
      current = current.add(1, 'day');
    }
    matrix.push(week);
  }

  return matrix;
}

interface CalendarWidgetProps {
  scheduledDates?: string[];
  onDateClick?: (date: string) => void;
}

export function CalendarWidget({ scheduledDates = [], onDateClick }: CalendarWidgetProps) {
  const [currentMonth, setCurrentMonth] = useState(dayjs());
  const today = dayjs();
  const weeks = buildCalendarMatrix(currentMonth);
  const monthLabel = currentMonth.format('MMMM YYYY');
  const scheduledSet = useMemo(() => new Set(scheduledDates), [scheduledDates]);

  return (
    <div className="calendar-widget glass-card">
      <header>
        <h3>{monthLabel}</h3>
        <div className="calendar-widget__nav">
          <button
            type="button"
            onClick={() => setCurrentMonth(currentMonth.subtract(1, 'month'))}
            aria-label="Previous month"
          >
            <FiChevronLeft />
          </button>
          <button
            type="button"
            onClick={() => setCurrentMonth(currentMonth.add(1, 'month'))}
            aria-label="Next month"
          >
            <FiChevronRight />
          </button>
        </div>
      </header>
      <div className="calendar-widget__grid">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day) => (
          <span key={day} className="calendar-widget__day calendar-widget__day--label">
            {day}
          </span>
        ))}
        {weeks.flat().map((date) => {
          const iso = date.format('YYYY-MM-DD');
          const isCurrentMonth = date.month() === currentMonth.month();
          const isToday = date.isSame(today, 'day');
          const isScheduled = scheduledSet.has(iso);
          return (
            <button
              key={date.toString()}
              type="button"
              className={[
                'calendar-widget__day',
                isCurrentMonth ? '' : 'calendar-widget__day--muted',
                isToday ? 'calendar-widget__day--today' : '',
                isScheduled ? 'calendar-widget__day--scheduled' : ''
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => {
                if (isScheduled && onDateClick) {
                  onDateClick(iso);
                }
              }}
            >
              {date.date()}
            </button>
          );
        })}
      </div>
      <button type="button" className="calendar-widget__cta" onClick={() => onDateClick?.(today.format('YYYY-MM-DD'))}>
        Content Scheduler
      </button>
    </div>
  );
}
