import { useState } from 'react';
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

export function CalendarWidget() {
  const [currentMonth, setCurrentMonth] = useState(dayjs());
  const today = dayjs();
  const weeks = buildCalendarMatrix(currentMonth);
  const monthLabel = currentMonth.format('MMMM YYYY');

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
          const isCurrentMonth = date.month() === currentMonth.month();
          const isToday = date.isSame(today, 'day');
          return (
            <button
              key={date.toString()}
              type="button"
              className={[
                'calendar-widget__day',
                isCurrentMonth ? '' : 'calendar-widget__day--muted',
                isToday ? 'calendar-widget__day--today' : ''
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {date.date()}
            </button>
          );
        })}
      </div>
      <button type="button" className="calendar-widget__cta">
        Content Scheduler
      </button>
    </div>
  );
}