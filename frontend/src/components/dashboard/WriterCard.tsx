import { useNavigate } from 'react-router-dom';
import { FiArrowRight, FiPenTool } from 'react-icons/fi';
import './writerCard.css';

export function WriterCard() {
  const navigate = useNavigate();

  return (
    <div className="writer-card glass-card">
      <div className="writer-card__icon">
        <FiPenTool />
      </div>
      <div className="writer-card__content">
        <h3>Blog Writer</h3>
        <p>Generate SEO-optimized blog articles with outlines, SEO briefs, and ready-to-publish drafts.</p>
        <button type="button" onClick={() => navigate('/writer')}>
          Start writing
          <FiArrowRight />
        </button>
      </div>
    </div>
  );
}
