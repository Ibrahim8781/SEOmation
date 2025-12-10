import type { Topic } from '@/types';
import { FiEdit3 } from 'react-icons/fi';
import './topicCard.css';

interface TopicCardProps {
  topic: Topic;
  onSelect?: (topic: Topic) => void;
}

export function TopicCard({ topic, onSelect }: TopicCardProps) {
  const keyword = topic.targetKeyword || null;

  return (
    <div className="topic-card glass-card">
      <h3>{topic.title}</h3>
      <p className="topic-card__meta">{keyword ? `Focus: ${keyword}` : 'Tap to craft this idea.'}</p>
      <button type="button" className="topic-card__cta" onClick={() => onSelect?.(topic)}>
        <FiEdit3 />
        Craft outline
      </button>
    </div>
  );
}
