import type { Topic } from '@/types';
import { FiEdit3 } from 'react-icons/fi';
import './topicCard.css';

interface TopicCardProps {
  topic: Topic;
  onSelect?: (topic: Topic) => void;
}

export function TopicCard({ topic, onSelect }: TopicCardProps) {
  const keyword = topic.targetKeyword || null;
  const trendTag = formatTrendTag(topic.aiMeta?.trendTag);
  const rationale = topic.rationale?.trim() || 'Refined to match your audience, search intent, and current strategy.';

  return (
    <div className="topic-card">
      <div className="topic-card__eyebrow">
        <span className={`topic-card__tag topic-card__tag--${trendTag.variant}`}>{trendTag.label}</span>
        {keyword && <span className="topic-card__keyword">{keyword}</span>}
      </div>
      <h3>{topic.title}</h3>
      <p className="topic-card__meta">{rationale}</p>
      <button type="button" className="topic-card__cta" onClick={() => onSelect?.(topic)}>
        <FiEdit3 />
        Craft outline
      </button>
    </div>
  );
}

function formatTrendTag(value?: string | null) {
  const normalized = String(value || 'evergreen').toLowerCase();
  if (normalized === 'news-angle') {
    return { label: 'NEWS ANGLE', variant: 'news' };
  }
  if (normalized === 'seasonal-campaign' || normalized === 'trending-q4') {
    return { label: 'SEASONAL', variant: 'seasonal' };
  }
  return { label: 'EVERGREEN', variant: 'evergreen' };
}
