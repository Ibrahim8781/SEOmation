import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FiAlertCircle, FiCheck, FiClock, FiImage, FiLoader, FiSave, FiSend } from 'react-icons/fi';
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
  featured: 'Blog / LinkedIn',
  inline: 'Inline',
  instagram_main: 'Instagram'
};

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

export function ContentEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [content, setContent] = useState<ContentItem | null>(null);
  const [seoSummary, setSeoSummary] = useState<SeoSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [primaryKeyword, setPrimaryKeyword] = useState('');
  const [secondaryKeywords, setSecondaryKeywords] = useState<string[]>([]);
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

  const load = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await ContentAPI.getById(id);
      setContent(data);
      setTitle(data.title ?? '');
      setMetaDescription((data as any).metaDescription ?? '');
      setPrimaryKeyword((data as any).primaryKeyword ?? '');
      setSecondaryKeywords((data as any).secondaryKeywords ?? []);
      setBodyHtml(data.html ?? data.text ?? '');
      setSeoSummary((data as any).seoSummary ?? null);
      setImagePrompt(data.title ?? '');
      const social = (data.aiMeta as any)?.social || {};
      setLinkedinText(social.linkedin?.text || '');
      setInstagramText(social.instagram?.text || '');
    } catch (err) {
      setError(extractErrorMessage(err, 'Unable to load this draft.'));
    } finally {
      setLoading(false);
    }
  };

  const loadImages = async () => {
    if (!id) return;
    try {
      const { data } = await ContentAPI.listImages(id);
      setImages(data.items);
      // Try to keep selections
      if (!selectedInstagramImage && data.items.length) {
        const insta = data.items.find((i) => i.role === 'instagram_main');
        if (insta) setSelectedInstagramImage(insta.id);
      }
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
          secondaryKeywords
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
  }, [title, metaDescription, bodyHtml, primaryKeyword, secondaryKeywords]);

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    setStatusMessage('');
    try {
      const { data } = await ContentAPI.saveDraftWithSeo(id, {
        title,
        metaDescription,
        bodyHtml,
        primaryKeyword,
        secondaryKeywords,
        linkedinText,
        instagramText
      });
      setContent(data.item);
      setSeoSummary(data.seo);
      setStatusMessage(`Saved with SEO score ${Math.round(data.seo.total)}`);
    } catch (err) {
      setError(extractErrorMessage(err, 'Unable to save this draft.'));
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateImages = async () => {
    if (!id || !imagePrompt.trim()) return;
    setImageLoading(true);
    try {
      const payload: GenerateImagePayload = {
        prompt: imagePrompt,
        count: imageCount,
        role: imageRole,
        altText: imageAlt
      };
      await ContentAPI.generateImages(id, payload);
      await loadImages();
      setStatusMessage('Images generated and attached.');
    } catch (err) {
      setError(extractErrorMessage(err, 'Unable to generate images right now.'));
    } finally {
      setImageLoading(false);
    }
  };

  const handleUploadImage = async (file?: File | null) => {
    if (!id || !file) return;
    setImageLoading(true);
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
      setError(extractErrorMessage(err, 'Unable to upload image.'));
    } finally {
      setImageLoading(false);
    }
  };

  const handleDeleteImage = async (linkId: string) => {
    if (!id) return;
    setImageLoading(true);
    try {
      await ContentAPI.deleteImageLink(id, linkId);
      await loadImages();
      if (selectedInstagramImage === linkId) setSelectedInstagramImage('');
      if (selectedLinkedinImage === linkId) setSelectedLinkedinImage('');
      if (selectedWordpressImage === linkId) setSelectedWordpressImage('');
    } catch (err) {
      setError(extractErrorMessage(err, 'Unable to delete image.'));
    } finally {
      setImageLoading(false);
    }
  };

  const handlePublishNow = async () => {
    if (!id || !selectedIntegrationId) return;
    if (selectedPlatform === 'INSTAGRAM' && !selectedInstagramImage) {
      setError('Instagram requires selecting an image.');
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
      setError(extractErrorMessage(err, 'Unable to publish now.'));
    }
  };

  const handleSchedule = async () => {
    if (!id || !selectedIntegrationId || !scheduledTime) return;
    if (selectedPlatform === 'INSTAGRAM' && !selectedInstagramImage) {
      setError('Instagram requires selecting an image.');
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
      setError(extractErrorMessage(err, 'Unable to schedule this content.'));
    }
  };

  const seoComponents = seoSummary?.components ?? [];
  const latestJob = useMemo(() => jobs.find((job) => job.contentId === id), [jobs, id]);

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

  if (error) {
    return (
      <div className="content-editor-page">
        <div className="content-editor-error glass-card">{error}</div>
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
            value={secondaryKeywords.join(', ')}
            onChange={(e) => setSecondaryKeywords(toSecondary(e.target.value))}
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
          <div className="seo-panel glass-card">
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

          <div className="images-panel glass-card">
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
                  label="Platform"
                  value={imagePlatform}
                  onChange={(e) => setImagePlatform(e.target.value as 'blog' | 'linkedin' | 'instagram')}
                  options={[
                    { label: 'Blog / WordPress', value: 'blog' },
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
            <div className="images-grid">
              {images.map((item) => (
                <figure key={item.id} className="image-card glass-card">
                  <img src={item.image.url} alt={item.image.altText ?? 'content image'} />
                  <figcaption>
                    <span className="image-role">{roleLabel[item.role] || item.role}</span>
                    <p>{item.image.altText || 'No alt text'}</p>
                    <div className="image-selectors">
                      <label>
                        <input
                          type="radio"
                          name="insta-image"
                          checked={selectedInstagramImage === item.id}
                          onChange={() => setSelectedInstagramImage(item.id)}
                        />
                        Instagram
                      </label>
                      <label>
                        <input
                          type="radio"
                          name="linkedin-image"
                          checked={selectedLinkedinImage === item.id}
                          onChange={() => setSelectedLinkedinImage(item.id)}
                        />
                        LinkedIn
                      </label>
                      <label>
                        <input
                          type="radio"
                          name="wp-image"
                          checked={selectedWordpressImage === item.id}
                          onChange={() => setSelectedWordpressImage(item.id)}
                        />
                        Featured
                      </label>
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

          <div className="publish-panel glass-card">
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
                {latestJob.platform} · {new Date(latestJob.scheduledTime).toLocaleString()}
              </p>
            )}
            <Button variant="ghost" onClick={() => navigate('/schedule')}>
              View schedule
            </Button>
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
              options={integrations.map((i) => ({ label: `${i.platform} • ${i.id.slice(0, 6)}`, value: i.id }))}
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
