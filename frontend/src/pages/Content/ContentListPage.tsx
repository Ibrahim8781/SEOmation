import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiFileText, FiLoader, FiRefreshCw } from 'react-icons/fi';
import { ContentAPI } from '@/api/content';
import type { ContentItem } from '@/types';
import { extractErrorMessage } from '@/utils/error';
import { Button } from '@/components/ui/Button';
import './contentList.css';

export function ContentListPage() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await ContentAPI.list();
      setItems(data.items);
    } catch (err) {
      setError(extractErrorMessage(err, 'Unable to load your drafts right now.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="content-list-page">
      <header className="content-list-header">
        <div>
          <h1>Your drafts & posts</h1>
          <p>Open a draft to edit, score SEO, attach images, or schedule publishing.</p>
        </div>
        <div className="content-list-actions">
          <Button variant="ghost" onClick={load} leftIcon={<FiRefreshCw />} isLoading={loading}>
            Refresh
          </Button>
          <Button onClick={() => navigate('/writer')} leftIcon={<FiFileText />}>
            New draft
          </Button>
        </div>
      </header>

      {error && <div className="content-list-error glass-card">{error}</div>}

      <div className="content-list-grid">
        {loading && (
          <div className="content-list-placeholder glass-card">
            <FiLoader className="spin" aria-hidden />
            <p>Loading your drafts...</p>
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="content-list-placeholder glass-card">
            <p>No drafts yet. Generate one from the writer or import a topic.</p>
            <Button onClick={() => navigate('/writer')}>Generate content</Button>
          </div>
        )}

        {items.map((item) => (
          <article
            key={item.id}
            className="content-card glass-card"
            onClick={() => navigate(`/content/${item.id}`)}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'Enter') navigate(`/content/${item.id}`);
            }}
          >
            <div className="content-card__meta">
              <span className="content-card__badge">{item.platform}</span>
              <span className={`content-card__status status-${item.status.toLowerCase()}`}>
                {item.status}
              </span>
            </div>
            <h3>{item.title || 'Untitled draft'}</h3>
            <p className="content-card__excerpt">{item.text?.slice(0, 140) || 'No body yet.'}</p>
            <div className="content-card__footer">
              <span>{new Date(item.updatedAt).toLocaleString()}</span>
              <span className="content-card__lang">{item.language}</span>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
