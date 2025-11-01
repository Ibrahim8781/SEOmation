import type { Topic } from '@/types';
import { FiEdit3, FiThumbsUp } from 'react-icons/fi';
import './topicCard.css';

interface TopicCardProps {
  topic: Topic;
  onSelect?: (topic: Topic) => void;
}

export function TopicCard({ topic, onSelect }: TopicCardProps) {
  const platformLabel = topic.platform.charAt(0) + topic.platform.slice(1).toLowerCase();
  const score = topic.relevance ? Math.round(topic.relevance * 100) : null;
  const keyword = topic.targetKeyword || null;
  const trendTag =
    typeof topic.aiMeta?.trendTag === 'string' ? prettyLabel(topic.aiMeta.trendTag) : null;
  const clusterLabel =
    typeof topic.aiMeta?.cluster === 'string' ? topic.aiMeta.cluster : undefined;

  return (
    <div className="topic-card glass-card">
      <div className="topic-card__header">
        <span className={`topic-card__platform topic-card__platform--${topic.platform.toLowerCase()}`}>
          {platformLabel}
        </span>
        {score !== null && (
          <span className="topic-card__score">
            <FiThumbsUp />
            {score}%
          </span>
        )}
      </div>
      <h3>{topic.title}</h3>
      <p className="topic-card__meta">
        Language: {topic.language === 'EN' ? 'English' : 'German'}
        {keyword ? ` • Focus: ${keyword}` : ''}
      </p>
      {clusterLabel && <p className="topic-card__meta topic-card__meta--sub">Cluster: {clusterLabel}</p>}
      {trendTag && <span className="topic-card__trend">{trendTag}</span>}
      <button type="button" className="topic-card__cta" onClick={() => onSelect?.(topic)}>
        <FiEdit3 />
        Craft outline
      </button>
    </div>
  );
}

function prettyLabel(value: string) {
  return value.replace(/[-_]/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}
