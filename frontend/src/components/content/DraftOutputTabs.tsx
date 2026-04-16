import { useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { FiCheck, FiCopy, FiRefreshCw, FiSend } from 'react-icons/fi';
import { RichTextEditor } from '@/components/editor/RichTextEditor';
import { Textarea } from '@/components/ui/Textarea';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import type { SupportedLanguage } from '@/utils/languages';
import './draftOutputTabs.css';

export type DraftTabKey = 'blog' | 'instagram' | 'linkedin' | 'images' | 'seo';

interface DraftImageItem {
  id: string;
  url: string;
  caption: string;
}

interface DraftOutputTabsProps {
  title?: string;
  onTitleChange?: (value: string) => void;
  primaryKeyword?: string;
  onPrimaryKeywordChange?: (value: string) => void;
  metaDescription?: string;
  onMetaDescriptionChange?: (value: string) => void;
  secondaryKeywords?: string;
  onSecondaryKeywordsChange?: (value: string) => void;
  blogHtml: string;
  onBlogHtmlChange: (value: string) => void;
  onSaveDraft?: () => void | Promise<void>;
  onPublishSchedule?: () => void | Promise<void>;
  saveBusy?: boolean;
  publishBusy?: boolean;
  saveDisabled?: boolean;
  publishDisabled?: boolean;
  lastUpdatedLabel?: string;
  instagramText?: string;
  onInstagramTextChange?: (value: string) => void;
  instagramLimit?: number;
  linkedinText?: string;
  onLinkedinTextChange?: (value: string) => void;
  linkedinLimit?: number;
  images?: DraftImageItem[];
  imagesLoading?: boolean;
  imageLoadingLabel?: string;
  imagesError?: string | null;
  imagesEmptyLabel?: string;
  onRegenerateImages?: () => void | Promise<void>;
  imagesRegenerating?: boolean;
  seoScore?: number | null;
  seoBreakdown?: string[];
  onCopyText?: (value: string) => Promise<boolean>;
  onCopyFailure?: () => void;
  className?: string;
  initialTab?: DraftTabKey;
  instagramEmptyLabel?: string;
  linkedinEmptyLabel?: string;
  language?: SupportedLanguage | string | null;
}

const TABS: Array<{ key: DraftTabKey; label: string }> = [
  { key: 'blog', label: 'Blog Draft' },
  { key: 'instagram', label: 'Instagram Caption' },
  { key: 'linkedin', label: 'LinkedIn Description' },
  { key: 'images', label: 'Images' },
  { key: 'seo', label: 'SEO Score' }
];

export function DraftOutputTabs({
  title = '',
  onTitleChange,
  primaryKeyword = '',
  onPrimaryKeywordChange,
  metaDescription = '',
  onMetaDescriptionChange,
  secondaryKeywords = '',
  onSecondaryKeywordsChange,
  blogHtml,
  onBlogHtmlChange,
  onSaveDraft,
  onPublishSchedule,
  saveBusy = false,
  publishBusy = false,
  saveDisabled = false,
  publishDisabled = false,
  lastUpdatedLabel,
  instagramText = '',
  onInstagramTextChange,
  instagramLimit,
  linkedinText = '',
  onLinkedinTextChange,
  linkedinLimit,
  images = [],
  imagesLoading = false,
  imageLoadingLabel,
  imagesError,
  imagesEmptyLabel = 'No images were generated for this run yet.',
  onRegenerateImages,
  imagesRegenerating = false,
  seoScore = null,
  seoBreakdown = [],
  onCopyText,
  onCopyFailure,
  className,
  initialTab = 'blog',
  instagramEmptyLabel = 'Instagram caption is not available for this run.',
  linkedinEmptyLabel = 'LinkedIn description is not available for this run.',
  language
}: DraftOutputTabsProps) {
  const [activeTab, setActiveTab] = useState<DraftTabKey>(initialTab);
  const [copiedKey, setCopiedKey] = useState<DraftTabKey | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const copyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const copyValue = async (tab: DraftTabKey, value: string) => {
    const text = value.trim();
    if (!text) return;

    let copied = false;
    if (onCopyText) {
      copied = await onCopyText(text);
    } else {
      try {
        if ('clipboard' in navigator) {
          await navigator.clipboard.writeText(text);
          copied = true;
        }
      } catch {
        copied = false;
      }
    }

    if (!copied) {
      setCopyError('Copy failed - try selecting the text manually.');
      onCopyFailure?.();
      return;
    }

    setCopyError(null);
    setCopiedKey(tab);
    if (copyTimerRef.current) {
      window.clearTimeout(copyTimerRef.current);
    }
    copyTimerRef.current = window.setTimeout(() => {
      setCopiedKey(null);
    }, 1800);
  };

  const instagramLength = instagramText.trim().length;
  const linkedInLength = linkedinText.trim().length;
  const instagramHelper = instagramLimit
    ? `${instagramLength}/${instagramLimit} characters`
    : `${instagramLength} characters`;
  const linkedinHelper = linkedinLimit
    ? `${linkedInLength}/${linkedinLimit} characters`
    : `${linkedInLength} characters`;

  return (
    <div className={clsx('draft-tabs', className)}>
      <div className="draft-tabs__bar" role="tablist" aria-label="Draft output sections">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            className={clsx('draft-tabs__tab', activeTab === tab.key && 'is-active')}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="draft-tabs__panel">
        {activeTab === 'blog' && (
          <section className="draft-tabs__section" role="tabpanel" aria-label="Blog draft output">
            <div className="draft-tabs__seo-fields">
              <div className="draft-tabs__seo-grid">
                <Input
                  label="Title"
                  value={title}
                  onChange={(event) => onTitleChange?.(event.target.value)}
                  placeholder="Enter blog title"
                />
                <Input
                  label="Primary keyword"
                  value={primaryKeyword}
                  onChange={(event) => onPrimaryKeywordChange?.(event.target.value)}
                  placeholder="Enter primary keyword"
                />
              </div>
              <Textarea
                label="Meta description"
                value={metaDescription}
                onChange={(event) => onMetaDescriptionChange?.(event.target.value)}
                rows={3}
                placeholder="Write a concise meta description"
              />
              <Input
                label="Secondary keywords comma separated"
                value={secondaryKeywords}
                onChange={(event) => onSecondaryKeywordsChange?.(event.target.value)}
                placeholder="keyword one, keyword two, keyword three"
              />
            </div>

            <RichTextEditor
              value={blogHtml}
              onChange={onBlogHtmlChange}
              helperText="Edit your draft directly. Changes apply immediately."
              language={language}
            />

            {(onSaveDraft || onPublishSchedule) && (
              <div className="draft-tabs__footer-actions">
                <div className="draft-tabs__action-row">
                  {onSaveDraft && (
                    <Button
                      type="button"
                      variant="secondary"
                      className="draft-tabs__action-btn draft-tabs__action-btn--save"
                      onClick={() => {
                        void onSaveDraft();
                      }}
                      isLoading={saveBusy}
                      disabled={saveDisabled}
                    >
                      Save Draft
                    </Button>
                  )}
                  {onPublishSchedule && (
                    <Button
                      type="button"
                      className="draft-tabs__action-btn draft-tabs__action-btn--publish"
                      rightIcon={<FiSend />}
                      onClick={() => {
                        void onPublishSchedule();
                      }}
                      isLoading={publishBusy}
                      disabled={publishDisabled}
                    >
                      Publish and Schedule
                    </Button>
                  )}
                </div>
                {lastUpdatedLabel && <span className="draft-tabs__last-updated">{lastUpdatedLabel}</span>}
              </div>
            )}
          </section>
        )}

        {activeTab === 'instagram' && (
          <section className="draft-tabs__section" role="tabpanel" aria-label="Instagram caption output">
            <div className="draft-tabs__toolbar draft-tabs__toolbar--single">
              <button
                type="button"
                className="draft-tabs__copy"
                onClick={() => copyValue('instagram', instagramText)}
                disabled={!instagramText.trim()}
              >
                {copiedKey === 'instagram' ? <FiCheck aria-hidden /> : <FiCopy aria-hidden />}
                {copiedKey === 'instagram' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <Textarea
              value={instagramText}
              onChange={(event) => onInstagramTextChange?.(event.target.value)}
              rows={10}
              placeholder={instagramEmptyLabel}
              helperText={instagramHelper}
              readOnly={!onInstagramTextChange}
            />
          </section>
        )}

        {activeTab === 'linkedin' && (
          <section className="draft-tabs__section" role="tabpanel" aria-label="LinkedIn description output">
            <div className="draft-tabs__toolbar draft-tabs__toolbar--single">
              <button
                type="button"
                className="draft-tabs__copy"
                onClick={() => copyValue('linkedin', linkedinText)}
                disabled={!linkedinText.trim()}
              >
                {copiedKey === 'linkedin' ? <FiCheck aria-hidden /> : <FiCopy aria-hidden />}
                {copiedKey === 'linkedin' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <Textarea
              value={linkedinText}
              onChange={(event) => onLinkedinTextChange?.(event.target.value)}
              rows={10}
              placeholder={linkedinEmptyLabel}
              helperText={linkedinHelper}
              readOnly={!onLinkedinTextChange}
            />
            {linkedinLimit && linkedInLength > linkedinLimit && (
              <p className="draft-tabs__warning">
                This LinkedIn draft exceeds the platform limit. Trim it before publishing.
              </p>
            )}
          </section>
        )}

        {activeTab === 'images' && (
          <section className="draft-tabs__section" role="tabpanel" aria-label="Generated images output">
            <div className="draft-tabs__toolbar">
              <p className="draft-tabs__section-label">Generated images</p>
              {onRegenerateImages && (
                <button
                  type="button"
                  className="draft-tabs__regenerate"
                  onClick={() => {
                    void onRegenerateImages();
                  }}
                  disabled={imagesRegenerating}
                >
                  <FiRefreshCw aria-hidden className={imagesRegenerating ? 'spin' : ''} />
                  {imagesRegenerating ? 'Regenerating...' : 'Regenerate images'}
                </button>
              )}
            </div>

            {imagesError && <div className="draft-tabs__error">{imagesError}</div>}
            {imagesLoading && (
              <div className="draft-tabs__empty">{imageLoadingLabel || 'Generating images...'}</div>
            )}
            {!imagesLoading && images.length > 0 && (
              <div className="draft-tabs__image-grid">
                {images.map((image) => (
                  <figure key={image.id} className="draft-tabs__image-card">
                    <img src={image.url} alt={image.caption || 'Generated image'} />
                    <figcaption>{image.caption || 'Generated image'}</figcaption>
                  </figure>
                ))}
              </div>
            )}
            {!imagesLoading && images.length === 0 && !imagesError && (
              <div className="draft-tabs__empty">{imagesEmptyLabel}</div>
            )}
          </section>
        )}

        {activeTab === 'seo' && (
          <section className="draft-tabs__section" role="tabpanel" aria-label="SEO score output">
            <div className="draft-tabs__seo-score-wrap">
              <strong className="draft-tabs__seo-score">{seoScore ?? '--'}</strong>
              <span className="draft-tabs__seo-label">SEO Score</span>
            </div>
            {seoBreakdown.length > 0 && (
              <ul className="draft-tabs__seo-list">
                {seoBreakdown.map((item, index) => (
                  <li key={`${item.slice(0, 16)}-${index}`}>{item}</li>
                ))}
              </ul>
            )}
          </section>
        )}

        {copyError && <div className="draft-tabs__error">{copyError}</div>}
      </div>
    </div>
  );
}
