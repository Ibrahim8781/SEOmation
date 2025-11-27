import { useEffect, useState } from 'react';
import { FiLoader, FiRefreshCw, FiX } from 'react-icons/fi';
import { ScheduleAPI } from '@/api/schedule';
import type { ScheduleJob } from '@/types';
import { extractErrorMessage } from '@/utils/error';
import { Button } from '@/components/ui/Button';
import './schedule.css';

export function SchedulePage() {
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
    void load();
  }, []);

  const cancelJob = async (id: string) => {
    try {
      await ScheduleAPI.cancel(id);
      setJobs((prev) => prev.map((job) => (job.id === id ? { ...job, status: 'CANCELLED' } : job)));
    } catch {
      /* ignore */
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
          <div className="schedule-table__row">
            <span>No jobs yet.</span>
          </div>
        )}
        {jobs.map((job) => (
          <div className="schedule-table__row" key={job.id}>
            <span className={`pill pill-${job.platform.toLowerCase()}`}>{job.platform}</span>
            <span>{job.content?.title ?? 'Draft'}</span>
            <span>{new Date(job.scheduledTime).toLocaleString()}</span>
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
