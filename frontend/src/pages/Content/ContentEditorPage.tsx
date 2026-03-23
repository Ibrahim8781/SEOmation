import { useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { FiChevronDown, FiClock, FiImage, FiLoader, FiSave, FiSend } from 'react-icons/fi';
import { ContentAPI, type GenerateImagePayload } from '@/api/content';
import { IntegrationsAPI } from '@/api/integrations';
import { ScheduleAPI, type PublishPayload, type SchedulePayload } from '@/api/schedule';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import type {
  ContentImageLink,
  ContentItem,
  IntegrationPlatform,
  PlatformIntegration,
  ScheduleJob,
  SeoComponentScore,
  SeoSummary
} from '@/types';
import { extractErrorMessage } from '@/utils/error';
import './contentEditor.css';

type Severity = SeoComponentScore['severity'];

const severityClass: Record<Severity, string> = {
  ok: 'seo-chip--ok',
  warn: 'seo-chip--warn',
  error: 'seo-chip--error'
};

const platformRoleMap: Record<'blog' | 'linkedin' | 'instagram', string> = {
  blog: 'featured',
  linkedin: 'featured',
  instagram: 'instagram_main'
};

const roleLabel: Record<string, string> = {
  featured: 'Landscape',
  inline: 'Flexible',
  instagram_main: 'Square'
};

const publishImageTargets: {
  key: 'WORDPRESS' | 'LINKEDIN' | 'INSTAGRAM';
  label: string;
  description: string;
}[] = [
  { key: 'WORDPRESS', label: 'WordPress', description: 'Blog cover / featured image' },
  { key: 'LINKEDIN', label: 'LinkedIn', description: 'Social post image' },
  { key: 'INSTAGRAM', label: 'Instagram', description: 'Feed image' }
];

const platformOptions: { label: string; value: IntegrationPlatform }[] = [
  { label: 'WordPress', value: 'WORDPRESS' },
  { label: 'LinkedIn', value: 'LINKEDIN' },
  { label: 'Instagram', value: 'INSTAGRAM' }
];

function toSecondary(input: string): string[] {
  if (!input) return [];
  return input
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

function generatedMetaDescriptionFromContent(item: ContentItem): string {
  const structure = item.aiMeta?.contentStructure;
  if (!structure || typeof structure !== 'object' || Array.isArray(structure)) return '';
  const meta = (structure as { meta?: unknown }).meta;
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return '';
  const description = (meta as { description?: unknown }).description;
  return typeof description === 'string' ? description : '';
}

function generatedPrimaryKeywordFromContent(item: ContentItem): string {
  const focusKeyword = item.seoMeta?.focusKeyword;
  return typeof focusKeyword === 'string' ? focusKeyword : '';
}

function seoImagesFromLinks(items: ContentImageLink[]) {
  return items
    .map((item) => ({ altText: item.image.altText ?? undefined }))
    .filter((item) => Boolean(item.altText));
}

export function ContentEditorPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [content, setContent] = useState<ContentItem | null>(null);
  const [seoSummary, setSeoSummary] = useState<SeoSummary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [title, setTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [primaryKeyword, setPrimaryKeyword] = useState('');
  const [secondaryKeywords, setSecondaryKeywords] = useState<string[]>([]);
  const [secondaryKeywordsInput, setSecondaryKeywordsInput] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [linkedinText, setLinkedinText] = useState('');
  const [instagramText, setInstagramText] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [images, setImages] = useState<ContentImageLink[]>([]);
  const [imageLoading, setImageLoading] = useState(false);
  const [imagePrompt, setImagePrompt] = useState('');
  const [imageCount, setImageCount] = useState(1);
  const [imagePlatform, setImagePlatform] = useState<'blog' | 'linkedin' | 'instagram'>('blog');
  const [imageRole, setImageRole] = useState('featured');
  const [imageAlt, setImageAlt] = useState('');
  const [selectedInstagramImage, setSelectedInstagramImage] = useState('');
  const [selectedLinkedinImage, setSelectedLinkedinImage] = useState('');
  const [selectedWordpressImage, setSelectedWordpressImage] = useState('');
  const [integrations, setIntegrations] = useState<PlatformIntegration[]>([]);
  const [jobs, setJobs] = useState<ScheduleJob[]>([]);
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [selectedIntegrationId, setSelectedIntegrationId] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState<IntegrationPlatform>('WORDPRESS');
  const [scheduledTime, setScheduledTime] = useState('');
  const scoreTimer = useRef<number | null>(null);
  const publishIntent = (location.state as { openPublishModal?: boolean } | null)?.openPublishModal;
  const [activeSidePanel, setActiveSidePanel] = useState<'seo' | 'images' | 'publishing'>('seo');

  const load = async () => {
    if (!id) return;
    setLoading(true);
    setLoadError(null);
    setErrorMessage('');
    try {
      const { data } = await ContentAPI.getById(id);
      setContent(data);
      setTitle(data.title ?? '');
      setMetaDescription(data.metaDescription ?? generatedMetaDescriptionFromContent(data) ?? '');
      setPrimaryKeyword(data.primaryKeyword ?? generatedPrimaryKeywordFromContent(data) ?? '');
      const loadedSecondaryKeywords = data.secondaryKeywords ?? [];
      setSecondaryKeywords(loadedSecondaryKeywords);
      setSecondaryKeywordsInput(loadedSecondaryKeywords.join(', '));
      setBodyHtml(data.html ?? data.text ?? '');
      setSeoSummary(data.seoSummary ?? null);
      setImagePrompt(data.title ?? '');
      const social = data.aiMeta?.social ?? {};
      setLinkedinText(social.linkedin?.text || '');
      setInstagramText(social.instagram?.text || '');
    } catch (err) {
      setLoadError(extractErrorMessage(err, 'Unable to load this draft.'));
    } finally {
      setLoading(false);
    }
  };

  const syncSelectedImages = (items: ContentImageLink[]) => {
    const featured = items.find((item) => item.role === 'featured') ?? items[0] ?? null;
    const instagram = items.find((item) => item.role === 'instagram_main') ?? items[0] ?? null;

    const hasWordpressSelection = items.some((item) => item.id === selectedWordpressImage);
    const hasLinkedinSelection = items.some((item) => item.id === selectedLinkedinImage);
    const hasInstagramSelection = items.some((item) => item.id === selectedInstagramImage);

    setSelectedWordpressImage(hasWordpressSelection ? selectedWordpressImage : featured?.id || '');
    setSelectedLinkedinImage(hasLinkedinSelection ? selectedLinkedinImage : featured?.id || '');
    setSelectedInstagramImage(hasInstagramSelection ? selectedInstagramImage : instagram?.id || '');
  };

  const loadImages = async () => {
    if (!id) return;
    try {
      const { data } = await ContentAPI.listImages(id);
      setImages(data.items);
      syncSelectedImages(data.items);
    } catch {
      /* ignore */
    }
  };

  const loadIntegrations = async () => {
    try {
      const { data } = await IntegrationsAPI.list();
      setIntegrations(data.items);
      if (data.items.length && !selectedIntegrationId) {
        setSelectedIntegrationId(data.items[0].id);
        setSelectedPlatform(data.items[0].platform);
      }
    } catch {
      /* ignore */
    }
  };

  const loadJobs = async () => {
    try {
      const { data } = await ScheduleAPI.list();
      setJobs(data.items);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    void load();
    void loadImages();
    void loadIntegrations();
    void loadJobs();
  }, [id]);

  useEffect(() => {
    if (publishIntent) {
      setPublishModalOpen(true);
    }
  }, [publishIntent]);

  useEffect(() => {
    setImageRole(platformRoleMap[imagePlatform]);
  }, [imagePlatform]);

  useEffect(() => {
    if (!primaryKeyword || !bodyHtml) return;
    if (scoreTimer.current) {
      window.clearTimeout(scoreTimer.current);
    }
    scoreTimer.current = window.setTimeout(async () => {
      setScoring(true);
      try {
        const { data } = await ContentAPI.scoreSeo({
          title,
          metaDescription,
          bodyHtml,
          primaryKeyword,
          secondaryKeywords,
          images: seoImagesFromLinks(images)
        });
        setSeoSummary(data);
      } catch {
        /* silent for live scoring */
      } finally {
        setScoring(false);
      }
    }, 700);
    return () => {
      if (scoreTimer.current) {
        window.clearTimeout(scoreTimer.current);
      }
    };
  }, [title, metaDescription, bodyHtml, primaryKeyword, secondaryKeywords, images]);

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    setStatusMessage('');
    setErrorMessage('');
    try {
      const { data } = await ContentAPI.saveDraftWithSeo(id, {
        title,
        metaDescription,
        bodyHtml,
        primaryKeyword,
        secondaryKeywords,
        images: seoImagesFromLinks(images),
        linkedinText,
        instagramText
      });
      setContent(data.item);
      setSeoSummary(data.seo);
      setStatusMessage(`Saved with SEO score ${Math.round(data.seo.total)}`);
    } catch (err) {
      setErrorMessage(extractErrorMessage(err, 'Unable to save this draft.'));
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateImages = async () => {
    if (!id || !imagePrompt.trim()) return;
    setImageLoading(true);
    setErrorMessage('');
    try {
      const payload: GenerateImagePayload = {
        prompt: imagePrompt,
        platform: imagePlatform,
        count: imageCount,
        role: imageRole,
        altText: imageAlt
      };
      await ContentAPI.generateImages(id, payload);
      await loadImages();
      setStatusMessage('Images generated and attached.');
    } catch (err) {
      setErrorMessage(extractErrorMessage(err, 'Unable to generate images right now.'));
    } finally {
      setImageLoading(false);
    }
  };

  const handleUploadImage = async (file?: File | null) => {
    if (!id || !file) return;
    setImageLoading(true);
    setErrorMessage('');
    try {
      const dataUrl = await fileToDataUrl(file);
      await ContentAPI.uploadImage(id, {
        dataUrl,
        altText: imageAlt || file.name,
        role: imageRole,
        prompt: imagePrompt
      });
      await loadImages();
      setStatusMessage('Image uploaded and attached.');
    } catch (err) {
      setErrorMessage(extractErrorMessage(err, 'Unable to upload image.'));
    } finally {
      setImageLoading(false);
    }
  };

  const handleDeleteImage = async (linkId: string) => {
    if (!id) return;
    setImageLoading(true);
    setErrorMessage('');
    try {
      await ContentAPI.deleteImageLink(id, linkId);
      await loadImages();
    } catch (err) {
      setErrorMessage(extractErrorMessage(err, 'Unable to delete image.'));
    } finally {
      setImageLoading(false);
    }
  };

  const handlePublishNow = async () => {
    if (!id || !selectedIntegrationId) return;
    setErrorMessage('');
    if (selectedPlatform === 'INSTAGRAM' && !selectedInstagramImage) {
      setErrorMessage('Instagram requires selecting an image.');
      return;
    }
    try {
      const payload: PublishPayload = {
        integrationId: selectedIntegrationId,
        platform: selectedPlatform,
        media: {
          instagram: selectedInstagramImage || undefined,
          linkedin: selectedLinkedinImage || undefined,
          wordpressFeatured: selectedWordpressImage || undefined
        }
      };
      const { data } = await ScheduleAPI.publishNow(id, payload);
      setStatusMessage('Publish job created.');
      setPublishModalOpen(false);
      setJobs((prev) => [data.job, ...prev]);
    } catch (err) {
      setErrorMessage(extractErrorMessage(err, 'Unable to publish now.'));
    }
  };

  const handleSchedule = async () => {
    if (!id || !selectedIntegrationId || !scheduledTime) return;
    setErrorMessage('');
    if (selectedPlatform === 'INSTAGRAM' && !selectedInstagramImage) {
      setErrorMessage('Instagram requires selecting an image.');
      return;
    }
    const picked = dayjs(scheduledTime);
    if (!picked.isValid() || picked.isBefore(dayjs())) {
      setErrorMessage('Pick a future time for scheduling.');
      return;
    }
    try {
      const payload: SchedulePayload = {
        integrationId: selectedIntegrationId,
        platform: selectedPlatform,
        scheduledTime,
        media: {
          instagram: selectedInstagramImage || undefined,
          linkedin: selectedLinkedinImage || undefined,
          wordpressFeatured: selectedWordpressImage || undefined
        }
      };
      const { data } = await ScheduleAPI.schedule(id, payload);
      setStatusMessage('Schedule created.');
      setPublishModalOpen(false);
      setJobs((prev) => [data.job, ...prev]);
    } catch (err) {
      setErrorMessage(extractErrorMessage(err, 'Unable to schedule this content.'));
    }
  };

  const seoComponents = seoSummary?.components ?? [];
  const latestJob = useMemo(() => jobs.find((job) => job.contentId === id), [jobs, id]);
  const selectedImagesByPlatform = useMemo(
    () => ({
      WORDPRESS: images.find((item) => item.id === selectedWordpressImage) ?? null,
      LINKEDIN: images.find((item) => item.id === selectedLinkedinImage) ?? null,
      INSTAGRAM: images.find((item) => item.id === selectedInstagramImage) ?? null
    }),
    [images, selectedInstagramImage, selectedLinkedinImage, selectedWordpressImage]
  );

  const assignImageToPlatform = (platform: 'WORDPRESS' | 'LINKEDIN' | 'INSTAGRAM', imageId: string) => {
    if (platform === 'WORDPRESS') {
      setSelectedWordpressImage(imageId);
      return;
    }
    if (platform === 'LINKEDIN') {
      setSelectedLinkedinImage(imageId);
      return;
    }
    setSelectedInstagramImage(imageId);
  };

  const imageAssignmentsForCard = (imageId: string) =>
    publishImageTargets.filter((target) => {
      if (target.key === 'WORDPRESS') return selectedWordpressImage === imageId;
      if (target.key === 'LINKEDIN') return selectedLinkedinImage === imageId;
      return selectedInstagramImage === imageId;
    });

  if (loading) {
    return (
      <div className="content-editor-page">
        <div className="content-editor-loader glass-card">
          <FiLoader className="spin" aria-hidden />
          <p>Loading draft...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="content-editor-page">
        <div className="content-editor-error glass-card">{loadError}</div>
        <Button variant="ghost" onClick={() => navigate(-1)}>
          Go back
        </Button>
      </div>
    );
  }

  return (
    <div className="content-editor-page">
      <header className="content-editor-header">
        <div>
          <h1>Edit draft</h1>
          <p>Refine copy, review SEO, attach images, and publish.</p>
        </div>
        <div className="content-editor-actions">
          <Button variant="ghost" onClick={() => navigate('/content')}>
            Back to drafts
          </Button>
          <Button onClick={() => setPublishModalOpen(true)} leftIcon={<FiSend />}>
            Publish / Schedule
          </Button>
          <Button onClick={handleSave} leftIcon={<FiSave />} isLoading={saving}>
            Save draft
          </Button>
        </div>
      </header>

      {statusMessage && <div className="content-editor-banner glass-card">{statusMessage}</div>}
      {errorMessage && <div className="content-editor-error glass-card">{errorMessage}</div>}

      <div className="content-editor-grid">
        <section className="content-editor-main glass-card">
          <div className="form-grid">
            <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Input
              label="Primary keyword"
              value={primaryKeyword}
              onChange={(e) => setPrimaryKeyword(e.target.value)}
            />
          </div>
          <Textarea
            label="Meta description"
            value={metaDescription}
            onChange={(e) => setMetaDescription(e.target.value)}
            rows={2}
          />
          <Textarea
            label="Body (HTML or markdown)"
            value={bodyHtml}
            onChange={(e) => setBodyHtml(e.target.value)}
            rows={12}
          />
          <Input
            label="Secondary keywords (comma separated)"
            value={secondaryKeywordsInput}
            onChange={(e) => {
              const rawValue = e.target.value;
              setSecondaryKeywordsInput(rawValue);
              setSecondaryKeywords(toSecondary(rawValue));
            }}
          />
          <div className="form-grid">
            <Textarea
              label="LinkedIn post"
              rows={4}
              value={linkedinText}
              onChange={(e) => setLinkedinText(e.target.value)}
            />
            <Textarea
              label="Instagram caption"
              rows={4}
              value={instagramText}
              onChange={(e) => setInstagramText(e.target.value)}
            />
          </div>
          <div className="content-editor-footer">
            <div className="content-editor-meta">
              <FiClock /> Last updated {content ? new Date(content.updatedAt).toLocaleString() : '--'}
            </div>
            <Button variant="secondary" onClick={handleSave} isLoading={saving}>
              Save changes
            </Button>
          </div>
        </section>

        <aside className="content-editor-sidebar">
          <div className={`editor-side-panel glass-card ${activeSidePanel === 'seo' ? 'is-open' : ''}`}>
            <button
              type="button"
              className="editor-side-panel__header"
              onClick={() => setActiveSidePanel('seo')}
            >
              <span>SEO</span>
              <FiChevronDown className={activeSidePanel === 'seo' ? 'rotated' : ''} aria-hidden />
            </button>
            {activeSidePanel === 'seo' && (
              <div className="editor-side-panel__body">
                <div className="seo-panel">
                  <div className="seo-panel__header">
                    <div>
                      <p>SEO Score</p>
                      <h3>{seoSummary ? Math.round(seoSummary.total) : '—'}</h3>
                    </div>
                    {scoring && <FiLoader className="spin" aria-hidden />}
                  </div>
                  <div className="seo-panel__components">
                    {seoComponents.map((comp) => (
                      <div key={comp.id} className="seo-chip glass-card">
                        <div className="seo-chip__header">
                          <span className={`seo-chip__badge ${severityClass[comp.severity]}`}>{comp.label}</span>
                          <strong>
                            {comp.score}/{comp.max}
                          </strong>
                        </div>
                        <p>{comp.message}</p>
                      </div>
                    ))}
                    {seoComponents.length === 0 && <p className="muted">Score will appear as you type.</p>}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className={`editor-side-panel glass-card ${activeSidePanel === 'images' ? 'is-open' : ''}`}>
            <button
              type="button"
              className="editor-side-panel__header"
              onClick={() => setActiveSidePanel('images')}
            >
              <span>Images</span>
              <FiChevronDown className={activeSidePanel === 'images' ? 'rotated' : ''} aria-hidden />
            </button>
            {activeSidePanel === 'images' && (
              <div className="editor-side-panel__body">
                <div className="images-panel">
                  <div className="images-panel__header">
                    <h3>Images</h3>
                    <span className="images-count">{images.length} linked</span>
                  </div>
                  <div className="images-form">
                    <Input
                      label="Prompt"
                      value={imagePrompt}
                      onChange={(e) => setImagePrompt(e.target.value)}
                      placeholder="e.g. Futuristic workspace for SaaS team"
                    />
                    <div className="form-grid">
                      <Select
                        label="Generate for"
                        value={imagePlatform}
                        onChange={(e) => setImagePlatform(e.target.value as 'blog' | 'linkedin' | 'instagram')}
                        options={[
                          { label: 'WordPress', value: 'blog' },
                          { label: 'LinkedIn', value: 'linkedin' },
                          { label: 'Instagram', value: 'instagram' }
                        ]}
                      />
                      <Input
                        label="Alt text"
                        value={imageAlt}
                        onChange={(e) => setImageAlt(e.target.value)}
                        placeholder="Describe the image"
                      />
                    </div>
                    <div className="form-grid">
                      <Input
                        type="number"
                        min={1}
                        max={4}
                        label="Count"
                        value={imageCount}
                        onChange={(e) => setImageCount(Number(e.target.value))}
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        leftIcon={<FiImage />}
                        onClick={handleGenerateImages}
                        isLoading={imageLoading}
                      >
                        Generate
                      </Button>
                    </div>
                    <label className="upload-label">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleUploadImage(e.target.files?.[0])}
                        disabled={imageLoading}
                      />
                      <span>Upload image</span>
                    </label>
                  </div>
                  {images.length > 0 && (
                    <div className="image-assignment-list">
                      {publishImageTargets.map((target) => {
                        const selectedImage = selectedImagesByPlatform[target.key];
                        return (
                          <div key={target.key} className="image-assignment-row glass-card">
                            <div className="image-assignment-row__meta">
                              <p>{target.label}</p>
                              <strong>{selectedImage ? selectedImage.image.altText || 'Selected image' : 'No image selected'}</strong>
                              <span>{selectedImage ? target.description : `Choose an image for ${target.label}`}</span>
                            </div>
                            {selectedImage && (
                              <img
                                src={selectedImage.image.url}
                                alt={selectedImage.image.altText ?? `${target.label} selection`}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="images-grid">
                    {images.map((item) => (
                      <figure key={item.id} className="image-card glass-card">
                        <img src={item.image.url} alt={item.image.altText ?? 'content image'} />
                        <figcaption>
                          <div className="image-card__meta">
                            <span className="image-role">{roleLabel[item.role] || 'Image'}</span>
                            {imageAssignmentsForCard(item.id).length > 0 && (
                              <div className="image-card__badges">
                                {imageAssignmentsForCard(item.id).map((target) => (
                                  <span key={target.key} className="image-card__badge">
                                    {target.label}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <p className="image-card__title">{item.image.altText || 'No alt text'}</p>
                          {imageAssignmentsForCard(item.id).length > 0 && (
                            <p className="image-card__hint">Selected for {imageAssignmentsForCard(item.id).map((target) => target.label).join(', ')}</p>
                          )}
                          <div className="image-selectors">
                            {publishImageTargets.map((target) => {
                              const isSelected =
                                (target.key === 'WORDPRESS' && selectedWordpressImage === item.id) ||
                                (target.key === 'LINKEDIN' && selectedLinkedinImage === item.id) ||
                                (target.key === 'INSTAGRAM' && selectedInstagramImage === item.id);

                              return (
                                <button
                                  key={target.key}
                                  type="button"
                                  className={`image-choice-button ${isSelected ? 'is-selected' : ''}`}
                                  onClick={() => assignImageToPlatform(target.key, item.id)}
                                >
                                  <span>{target.label}</span>
                                </button>
                              );
                            })}
                          </div>
                          <Button
                            variant="ghost"
                            size="md"
                            onClick={() => handleDeleteImage(item.id)}
                            disabled={imageLoading}
                          >
                            Remove
                          </Button>
                        </figcaption>
                      </figure>
                    ))}
                    {images.length === 0 && <p className="muted">No images attached yet.</p>}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className={`editor-side-panel glass-card ${activeSidePanel === 'publishing' ? 'is-open' : ''}`}>
            <button
              type="button"
              className="editor-side-panel__header"
              onClick={() => setActiveSidePanel('publishing')}
            >
              <span>Publishing</span>
              <FiChevronDown className={activeSidePanel === 'publishing' ? 'rotated' : ''} aria-hidden />
            </button>
            {activeSidePanel === 'publishing' && (
              <div className="editor-side-panel__body">
                <div className="publish-panel">
                  <div className="publish-panel__row">
                    <div>
                      <p className="muted">Publishing</p>
                      <strong>{latestJob ? latestJob.status : 'Not scheduled'}</strong>
                    </div>
                    <Button variant="secondary" onClick={() => setPublishModalOpen(true)}>
                      Manage
                    </Button>
                  </div>
                  {latestJob && (
                    <p className="muted">
                      {latestJob.platform} - {new Date(latestJob.scheduledTime).toLocaleString()}
                    </p>
                  )}
                  <Button variant="ghost" onClick={() => navigate('/schedule')}>
                    View schedule
                  </Button>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      <Modal
        open={publishModalOpen}
        title="Publish or schedule"
        onClose={() => setPublishModalOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPublishModalOpen(false)}>
              Close
            </Button>
            <Button variant="secondary" onClick={handlePublishNow}>
              Publish now
            </Button>
            <Button onClick={handleSchedule} leftIcon={<FiClock />}>
              Schedule
            </Button>
          </>
        }
      >
        {integrations.length === 0 && (
          <div className="muted">
            No integrations yet. Connect one first from Settings → Integrations.
          </div>
        )}
        {integrations.length > 0 && (
          <div className="publish-form">
            <Select
              label="Integration"
              value={selectedIntegrationId}
              onChange={(e) => {
                const idVal = e.target.value;
                setSelectedIntegrationId(idVal);
                const found = integrations.find((i) => i.id === idVal);
                if (found) setSelectedPlatform(found.platform);
              }}
              options={integrations.map((i) => ({ label: `${i.platform} - ${i.id.slice(0, 6)}`, value: i.id }))}
            />
            <Select
              label="Platform"
              value={selectedPlatform}
              onChange={(e) => setSelectedPlatform(e.target.value as IntegrationPlatform)}
              options={platformOptions}
            />
            <Input
              type="datetime-local"
              label="Schedule time"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              min={dayjs().add(5, 'minute').format('YYYY-MM-DDTHH:mm')}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
