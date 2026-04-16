import { useNavigate } from 'react-router-dom';
import { FiArrowRight, FiPenTool } from 'react-icons/fi';
import './writerCard.css';

export function WriterCard() {
  const navigate = useNavigate();

  return (
    <div className="writer-card">
      <div className="writer-card__left">
        <div className="writer-card__icon">
          <FiPenTool />
        </div>
        <div className="writer-card__content">
          <h3>Blog Writer</h3>
          <p>Generate SEO-optimized blog articles with outlines, SEO briefs, and ready-to-publish drafts.</p>
          <div className="writer-card__pills">
            <span className="writer-card__pill">{`\u2726 SEO Brief`}</span>
            <span className="writer-card__pill">{`\u2726 Outline Generator`}</span>
            <span className="writer-card__pill">{`\u2726 Ready-to-publish Draft`}</span>
          </div>
        </div>
      </div>
      <button type="button" className="writer-card__cta" onClick={() => navigate('/writer')}>
        <span>Start writing</span>
        <FiArrowRight />
      </button>
    </div>
  );
}
