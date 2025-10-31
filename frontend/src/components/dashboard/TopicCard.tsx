import type { Topic } from '@/types';
import { FiEdit3, FiThumbsUp } from 'react-icons/fi';
import './topicCard.css';

interface TopicCardProps {
  topic: Topic;
}

export function TopicCard({ topic }: TopicCardProps) {
  const platformLabel = topic.platform.charAt(0) + topic.platform.slice(1).toLowerCase();
  const score = topic.relevance ? Math.round(topic.relevance * 100) : null;
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
      <p className="topic-card__meta">Language: {topic.language === 'EN' ? 'English' : 'German'}</p>
      <button type="button" className="topic-card__cta">
        <FiEdit3 />
        Craft outline
      </button>
    </div>
  );
}
