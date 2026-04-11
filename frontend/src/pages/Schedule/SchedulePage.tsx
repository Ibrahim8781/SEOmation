import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiLoader, FiRefreshCw, FiX } from 'react-icons/fi';
import { ScheduleAPI } from '@/api/schedule';
import type { ScheduleJob } from '@/types';
import { extractErrorMessage } from '@/utils/error';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { formatScheduledDateTime } from '@/utils/scheduleTime';
import './schedule.css';

export function SchedulePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<ScheduleJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await ScheduleAPI.list();
      setJobs(data.items);
    } catch (err) {
      setError(extractErrorMessage(err, 'Unable to load schedule.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initializePage = async () => {
      await load();
    };

    initializePage();
  }, []);

  const cancelJob = async (id: string) => {
    try {
      await ScheduleAPI.cancel(id);
      setJobs((prev) => prev.map((job) => (job.id === id ? { ...job, status: 'CANCELLED' } : job)));
    } catch (err) {
      setError(extractErrorMessage(err, 'Unable to cancel this job.'));
    }
  };

  return (
    <div className="schedule-page">
      <header className="schedule-header">
        <div>
          <h1>Publishing schedule</h1>
          <p>Track upcoming posts, recent publishes, and any failed attempts.</p>
        </div>
        <Button variant="ghost" leftIcon={<FiRefreshCw />} onClick={load} isLoading={loading}>
          Refresh
        </Button>
      </header>

      {error && <div className="schedule-error glass-card">{error}</div>}

      <div className="schedule-table glass-card">
        <div className="schedule-table__row schedule-table__head">
          <span>Platform</span>
          <span>Content</span>
          <span>Time</span>
          <span>Status</span>
          <span>Actions</span>
        </div>
        {loading && (
          <div className="schedule-table__row">
            <FiLoader className="spin" />
            <span>Loading jobs...</span>
          </div>
        )}
        {!loading && jobs.length === 0 && (
          <div className="schedule-empty">
            <p>No scheduled or published posts yet. Use the Blog Writer to create and schedule content.</p>
            <Button variant="secondary" onClick={() => navigate('/writer')}>
              Go to Blog Writer
            </Button>
          </div>
        )}
        {jobs.map((job) => (
          <div className="schedule-table__row" key={job.id}>
            <span className={`pill pill-${job.platform.toLowerCase()}`}>{job.platform}</span>
            <span>{job.content?.title ?? 'Draft'}</span>
            <span>
              {formatScheduledDateTime(job.scheduledTime, job.scheduledTimezone || user?.timezone)}
              {' '}
              ({job.scheduledTimezone || user?.timezone || 'UTC'})
            </span>
            <span className={`pill status-${job.status.toLowerCase()}`}>{job.status}</span>
            <span>
              {job.status === 'SCHEDULED' && (
                <Button variant="ghost" leftIcon={<FiX />} onClick={() => cancelJob(job.id)}>
                  Cancel
                </Button>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
