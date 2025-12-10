import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { FiCheck, FiChevronDown, FiCopy, FiEdit3, FiSend, FiX } from 'react-icons/fi';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useAuth } from '@/hooks/useAuth';
import { useOnboarding } from '@/hooks/useOnboarding';
import { ContentAPI, type GenerateContentPayload, type SeoHint } from '@/api/content';
import { IntegrationsAPI } from '@/api/integrations';
import { ScheduleAPI } from '@/api/schedule';
import type { ContentImageLink, IntegrationPlatform, PlatformIntegration, Topic } from '@/types';
import { extractErrorMessage } from '@/utils/error';
import './blogWriter.css';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
};

type ViewMode = 'html' | 'plain';

const languageOptions = [
  { label: 'English', value: 'EN' },
  { label: 'German', value: 'DE' }
];

const platformOptions: { label: string; value: IntegrationPlatform }[] = [
  { label: 'WordPress', value: 'WORDPRESS' },
  { label: 'LinkedIn', value: 'LINKEDIN' },
  { label: 'Instagram', value: 'INSTAGRAM' }
];

function getTimestamp() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function BlogWriterPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { businessProfile } = useOnboarding();
  const initialTopic = (location.state as { topic?: Topic } | undefined)?.topic ?? null;

  const welcomeMessage = useMemo(() => {
    if (businessProfile) {
      const audience = businessProfile.targetAudience || 'your audience';
      return `I'm ready to write for your ${businessProfile.niche} brand and ${audience}. Share a prompt or tweak the focus keyword to begin.`;
    }
    return 'Tell me about the topic, keywords, tone, and any calls-to-action. I will shape an SEO-ready blog post for you.';
  }, [businessProfile]);

  const [viewMode, setViewMode] = useState<ViewMode>('html');
  const [language, setLanguage] = useState<'EN' | 'DE'>(
    (initialTopic?.language as 'EN' | 'DE' | undefined) ??
      businessProfile?.language ??
      user?.language ??
      'EN'
  );
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(initialTopic);
  const [prompt, setPrompt] = useState('');
  const [focusKeyword, setFocusKeyword] = useState(
    initialTopic?.targetKeyword ?? initialTopic?.title ?? ''
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'assistant-welcome',
      role: 'assistant',
      content: welcomeMessage,
      timestamp: getTimestamp()
    }
  ]);
  const [blogHtml, setBlogHtml] = useState('');
  const [blogPlain, setBlogPlain] = useState('');
  const [instagramCopy, setInstagramCopy] = useState('');
  const [linkedinCopy, setLinkedinCopy] = useState('');
  const [includeInstagram, setIncludeInstagram] = useState(true);
  const [includeLinkedIn, setIncludeLinkedIn] = useState(true);
  const [includeImage, setIncludeImage] = useState(false);
  const [includeLinkedInImage, setIncludeLinkedInImage] = useState(false);
  const [includeInstagramImage, setIncludeInstagramImage] = useState(false);
  const [imagePrompt, setImagePrompt] = useState('');
  const [seoScore, setSeoScore] = useState<number | null>(null);
  const [seoHints, setSeoHints] = useState<SeoHint[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [copyMode, setCopyMode] = useState<'idle' | 'copied'>('idle');
  const [contentId, setContentId] = useState<string | null>(null);
  const [generatedImages, setGeneratedImages] = useState<ContentImageLink[]>([]);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [imagesError, setImagesError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [integrations, setIntegrations] = useState<PlatformIntegration[]>([]);
  const [selectedIntegrationId, setSelectedIntegrationId] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState<IntegrationPlatform>('WORDPRESS');
  const [scheduledTime, setScheduledTime] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [useImages, setUseImages] = useState(false);
  const [activePanel, setActivePanel] = useState<'blog' | 'instagram' | 'linkedin' | 'seo' | 'images' | null>(null);
  const panelRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const panelBodyRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const copyResetTimer = useRef<number | null>(null);
  const previousTopicIdRef = useRef<string | null>(initialTopic?.id ?? null);

  useEffect(() => {
    return () => {
      if (copyResetTimer.current) {
        window.clearTimeout(copyResetTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    setMessages((prev) => {
      if (prev.length === 1 && prev[0].id === 'assistant-welcome') {
        return [{ ...prev[0], content: welcomeMessage }];
      }
      return prev;
    });
  }, [welcomeMessage]);

  useEffect(() => {
    if (selectedTopic?.id && previousTopicIdRef.current !== selectedTopic.id) {
      setFocusKeyword(selectedTopic.targetKeyword ?? selectedTopic.title);
      if (selectedTopic.language && language !== selectedTopic.language) {
        setLanguage(selectedTopic.language);
      }
      setPrompt('');
      previousTopicIdRef.current = selectedTopic.id;
    }
    if (!selectedTopic) {
      previousTopicIdRef.current = null;
    }
  }, [selectedTopic, language]);

  useEffect(() => {
    setUseImages(generatedImages.length > 0);
  }, [generatedImages]);

  useEffect(() => {
    void loadIntegrations();
  }, []);

  const fetchImagesForContent = async (id: string) => {
    setImagesLoading(true);
    setImagesError(null);
    try {
      const { data } = await ContentAPI.listImages(id);
      setGeneratedImages(data.items);
    } catch (err) {
      setImagesError(extractErrorMessage(err, 'Unable to load generated images.'));
    } finally {
      setImagesLoading(false);
    }
  };

  const loadIntegrations = async () => {
    try {
      const { data } = await IntegrationsAPI.list();
      setIntegrations(data.items);
      if (data.items.length) {
        setSelectedIntegrationId((prev) => prev || data.items[0].id);
        setSelectedPlatform((prev) => prev || data.items[0].platform);
      }
    } catch {
      /* ignore list failures for now */
    }
  };

  const handlePromptSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isGenerating) return;

    const trimmedPrompt = prompt.trim();
    const trimmedKeyword = focusKeyword.trim();

    if (!selectedTopic && !trimmedPrompt) {
      setFormError('Add a prompt or pick a suggested topic to start writing.');
      return;
    }

    if (!trimmedKeyword) {
      setFormError('Provide a focus keyword so the draft can optimise around it.');
      return;
    }

    setFormError(null);
    setApiError(null);
    setImagesError(null);
    setStatusMessage('');

    const userContent = selectedTopic
      ? `Use the topic "${selectedTopic.title}" with focus keyword "${trimmedKeyword}".`
      : trimmedPrompt;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userContent,
      timestamp: getTimestamp()
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsGenerating(true);
    setCopyMode('idle');

    const payload: GenerateContentPayload = {
      platform: 'BLOG',
      language,
      includeInstagram,
      includeLinkedIn,
      includeImage,
      includeLinkedInImage,
      includeInstagramImage,
      imagePrompt: imagePrompt || selectedTopic?.title || trimmedPrompt || focusKeyword
    };

    if (selectedTopic) {
      payload.topicId = selectedTopic.id;
    } else {
      payload.prompt = trimmedPrompt;
      payload.focusKeyword = trimmedKeyword;
    }

    try {
      const { data } = await ContentAPI.generate(payload);
      const variants = data.variants ?? {};
      setContentId(data.item.id);
      setGeneratedImages([]);
      if (includeImage || includeLinkedInImage || includeInstagramImage) {
        void fetchImagesForContent(data.item.id);
      } else {
        setImagesLoading(false);
      }
      setBlogHtml(data.item.html ?? '');
      setBlogPlain(data.item.text ?? '');
      setLanguage(data.item.language as 'EN' | 'DE');
      setSeoScore(data.seo?.score ?? null);
      setSeoHints(data.seo?.hints ?? []);
      setInstagramCopy(includeInstagram ? variants.instagram?.text ?? '' : '');
      setLinkedinCopy(includeLinkedIn ? variants.linkedin?.text ?? '' : '');
      setFocusKeyword(data.focusKeyword);
      setActivePanel('blog');
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: `Draft ready! SEO score ${data.seo?.score ?? '—'}${
          variants.linkedin || variants.instagram ? ' with social captions included.' : '.'
        }`,
        timestamp: getTimestamp()
      };
      setMessages((prev) => [...prev, assistantMessage]);
      if (!selectedTopic) {
        setPrompt('');
      }
    } catch (error) {
      const message = extractErrorMessage(error, 'Unable to generate the draft right now.');
      setApiError(message);
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-error-${Date.now()}`,
          role: 'assistant',
          content: `I ran into an issue: ${message}`,
          timestamp: getTimestamp()
        }
      ]);
    } finally {
      setIsGenerating(false);
      setCopyMode('idle');
    }
  };

  const handleCopy = async () => {
    const payload = viewMode === 'html' ? blogHtml : blogPlain;
    if (!payload) return;

    try {
      if ('clipboard' in navigator) {
        await navigator.clipboard.writeText(payload);
        setCopyMode('copied');
        if (copyResetTimer.current) {
          window.clearTimeout(copyResetTimer.current);
        }
        copyResetTimer.current = window.setTimeout(() => setCopyMode('idle'), 2000);
      }
    } catch {
      // Clipboard failures can be surfaced with a toast once global notifications are available.
    }
  };

  const resolveMediaSelection = () => {
    if (!useImages || generatedImages.length === 0) return undefined;
    const media: {
      instagram?: string;
      linkedin?: string;
      wordpressFeatured?: string;
    } = {};
    const featured =
      generatedImages.find((img) => img.role === 'featured') ??
      generatedImages.find((img) => img.role === 'inline') ??
      generatedImages[0];
    const insta = generatedImages.find((img) => img.role === 'instagram_main');

    if (featured) {
      media.wordpressFeatured = featured.id;
      media.linkedin = featured.id;
    }
    if (insta) {
      media.instagram = insta.id;
    }

    return Object.keys(media).length ? media : undefined;
  };

  const handlePublishOpen = () => {
    if (!contentId) return;
    setPublishError(null);
    setPublishModalOpen(true);
    if (!integrations.length) {
      void loadIntegrations();
    }
  };

  const handlePublishNow = async () => {
    if (!contentId) return;
    if (!selectedIntegrationId) {
      setPublishError('Select an integration to publish.');
      return;
    }

    setPublishing(true);
    setPublishError(null);
    try {
      const { data } = await ScheduleAPI.publishNow(contentId, {
        integrationId: selectedIntegrationId,
        platform: selectedPlatform,
        media: resolveMediaSelection()
      });
      setStatusMessage('Publish job created.');
      setPublishModalOpen(false);
      setScheduledTime('');
      // optional: surface job id or platform later
      return data.job;
    } catch (err) {
      setPublishError(extractErrorMessage(err, 'Unable to publish right now.'));
    } finally {
      setPublishing(false);
    }
  };

  const handleSchedule = async () => {
    if (!contentId) return;
    if (!selectedIntegrationId) {
      setPublishError('Select an integration to schedule.');
      return;
    }
    if (!scheduledTime) {
      setPublishError('Pick a time to schedule.');
      return;
    }

    setPublishing(true);
    setPublishError(null);
    try {
      const { data } = await ScheduleAPI.schedule(contentId, {
        integrationId: selectedIntegrationId,
        platform: selectedPlatform,
        scheduledTime,
        media: resolveMediaSelection()
      });
      setStatusMessage('Schedule created.');
      setPublishModalOpen(false);
      setScheduledTime('');
      return data.job;
    } catch (err) {
      setPublishError(extractErrorMessage(err, 'Unable to schedule this content.'));
    } finally {
      setPublishing(false);
    }
  };

  const handleEditDraft = () => {
    if (!contentId) return;
    navigate(`/content/${contentId}`);
  };

  const handlePublishSchedule = () => {
    if (!contentId) return;
    handlePublishOpen();
  };

  const hasBlogDraft = Boolean(blogHtml || blogPlain);
  const hasSeoInsights = seoScore !== null || seoHints.length > 0;

  const togglePanel = (panel: typeof activePanel) => {
    setActivePanel((prev) => (prev === panel ? panel : panel));
  };

  useEffect(() => {
    if (hasBlogDraft && activePanel === null) {
      setActivePanel('blog');
    }
  }, [hasBlogDraft, activePanel]);

  useEffect(() => {
    if (!activePanel) return;
    const ref = panelRefs.current[activePanel];

    Object.entries(panelBodyRefs.current).forEach(([key, node]) => {
      if (node) {
        if (key === activePanel) {
          node.style.maxHeight = `${node.scrollHeight}px`;
          node.style.opacity = '1';
          node.style.paddingTop = '0.75rem';
          node.style.paddingBottom = '1rem';
        } else {
          node.style.maxHeight = '0px';
          node.style.opacity = '0';
          node.style.paddingTop = '0';
          node.style.paddingBottom = '0';
        }
      }
    });

    if (ref) {
      window.requestAnimationFrame(() => {
        ref.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
      });
    }
  }, [activePanel]);

  return (
    <div className="blog-writer-page">
      <header className="blog-writer-header">
        <div>
          <h1>SEO-Based Blog Writer</h1>
          <p>
            Craft an outline, send a quick prompt, and review the SEO-friendly draft, HTML markup, and social
            captions without leaving your workspace.
          </p>
        </div>
        <div className="blog-writer-header__actions">
          <Select
            label="Language"
            value={language}
            onChange={(event) => setLanguage(event.target.value as 'EN' | 'DE')}
            options={languageOptions}
          />
          <Button
            type="button"
            variant="ghost"
            leftIcon={<FiEdit3 />}
            onClick={handleEditDraft}
            disabled={!contentId}
            title={contentId ? 'Open this draft in the editor' : 'Generate a draft first'}
          >
            Edit draft
          </Button>
          <Button
            type="button"
            variant="secondary"
            leftIcon={<FiSend />}
            onClick={handlePublishSchedule}
            disabled={!contentId}
            title={contentId ? 'Publish or schedule this draft' : 'Generate a draft first'}
          >
            Publish / Schedule
          </Button>
        </div>
      </header>

      {statusMessage && <div className="blog-writer-banner glass-card">{statusMessage}</div>}

      {selectedTopic && (
        <div className="blog-writer-topic glass-card">
          <div className="blog-writer-topic__details">
            <span className="blog-writer-topic__label">Topic</span>
            <strong>{selectedTopic.title}</strong>
            {selectedTopic.targetKeyword && (
              <span className="blog-writer-topic__keyword">
                Focus: {selectedTopic.targetKeyword}
              </span>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            
            leftIcon={<FiX />}
            onClick={() => {
              setSelectedTopic(null);
              setFocusKeyword('');
            }}
          >
            Clear topic
          </Button>
        </div>
      )}

      <main className="blog-writer-body">
        <section className="blog-writer-output glass-card">
          {apiError && <div className="blog-writer-alert">{apiError}</div>}

          {!hasBlogDraft && (
            <div className="blog-writer-output__placeholder large">
              <p>Your SEO-ready draft will appear here after you send a prompt.</p>
            </div>
          )}

          {hasBlogDraft && (
            <div className="blog-writer-accordion">
              {/* Blog */}
              <div
                className={clsx('blog-writer-accordion__item', activePanel === 'blog' && 'is-open')}
                ref={(el) => {
                  panelRefs.current.blog = el;
                }}
              >
                <button type="button" className="blog-writer-accordion__header" onClick={() => togglePanel('blog')}>
                  <div>
                    <p className="eyebrow">Blog draft</p>
                    <span className="muted">
                      {viewMode === 'html' ? 'HTML markup' : 'Readable view'} • {focusKeyword || 'No keyword yet'}
                    </span>
                  </div>
                  <div className="blog-writer-accordion__header-actions">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={handleCopy}
                      leftIcon={copyMode === 'copied' ? <FiCheck /> : <FiCopy />}
                      disabled={!hasBlogDraft}
                    >
                      {copyMode === 'copied' ? 'Copied' : 'Copy'}
                    </Button>
                    <FiChevronDown aria-hidden className={clsx(activePanel === 'blog' && 'rotated')} />
                  </div>
                </button>
                <div
                  className="blog-writer-accordion__body"
                  ref={(el) => {
                    panelBodyRefs.current.blog = el;
                  }}
                >
                  <div className="blog-writer-output__switch compact">
                    <span className={clsx('blog-writer-switch-label', viewMode === 'html' && 'is-active')}>
                      HTML
                    </span>
                    <button
                      type="button"
                      className={clsx('blog-writer-switch', viewMode === 'plain' && 'blog-writer-switch--on')}
                      onClick={() => setViewMode((prev) => (prev === 'html' ? 'plain' : 'html'))}
                      aria-pressed={viewMode === 'plain'}
                      aria-label="Toggle between HTML view and readable view"
                    >
                      <span className="blog-writer-switch__thumb" />
                    </button>
                    <span className={clsx('blog-writer-switch-label', viewMode === 'plain' && 'is-active')}>
                      Readable
                    </span>
                  </div>

                  {viewMode === 'html' && <pre className="blog-writer-output__code">{blogHtml}</pre>}
                  {viewMode === 'plain' && (
                    <article className="blog-writer-output__article">
                      {blogPlain.split('\n\n').map((paragraph, index) => (
                        <p key={index}>{paragraph}</p>
                      ))}
                    </article>
                  )}
                </div>
              </div>

              {/* Instagram */}
              {includeInstagram && instagramCopy && (
                <div
                  className={clsx('blog-writer-accordion__item', activePanel === 'instagram' && 'is-open')}
                  ref={(el) => {
                    panelRefs.current.instagram = el;
                  }}
                >
                  <button
                    type="button"
                    className="blog-writer-accordion__header"
                    onClick={() => togglePanel('instagram')}
                  >
                    <div>
                      <p className="eyebrow">Instagram</p>
                      <span className="muted">Caption</span>
                    </div>
                    <div className="blog-writer-accordion__header-actions">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={async () => {
                          try {
                            if ('clipboard' in navigator) {
                              await navigator.clipboard.writeText(instagramCopy);
                            }
                          } catch {
                            /* ignore */
                          }
                        }}
                        leftIcon={<FiCopy />}
                      >
                        Copy
                      </Button>
                      <FiChevronDown aria-hidden className={clsx(activePanel === 'instagram' && 'rotated')} />
                    </div>
                  </button>
                  <div
                    className="blog-writer-accordion__body"
                    ref={(el) => {
                      panelBodyRefs.current.instagram = el;
                    }}
                  >
                    <p className="blog-writer-snippet__text">{instagramCopy}</p>
                  </div>
                </div>
              )}

              {/* LinkedIn */}
              {includeLinkedIn && linkedinCopy && (
                <div
                  className={clsx('blog-writer-accordion__item', activePanel === 'linkedin' && 'is-open')}
                  ref={(el) => {
                    panelRefs.current.linkedin = el;
                  }}
                >
                  <button
                    type="button"
                    className="blog-writer-accordion__header"
                    onClick={() => togglePanel('linkedin')}
                  >
                    <div>
                      <p className="eyebrow">LinkedIn</p>
                      <span className="muted">Description</span>
                    </div>
                    <div className="blog-writer-accordion__header-actions">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={async () => {
                          try {
                            if ('clipboard' in navigator) {
                              await navigator.clipboard.writeText(linkedinCopy);
                            }
                          } catch {
                            /* ignore */
                          }
                        }}
                        leftIcon={<FiCopy />}
                      >
                        Copy
                      </Button>
                      <FiChevronDown aria-hidden className={clsx(activePanel === 'linkedin' && 'rotated')} />
                    </div>
                  </button>
                  <div
                    className="blog-writer-accordion__body"
                    ref={(el) => {
                      panelBodyRefs.current.linkedin = el;
                    }}
                  >
                    <p className="blog-writer-snippet__text">{linkedinCopy}</p>
                  </div>
                </div>
              )}

              {/* Images */}
              {(generatedImages.length > 0 || imagesLoading || imagesError) && (
                <div
                  className={clsx('blog-writer-accordion__item', activePanel === 'images' && 'is-open')}
                  ref={(el) => {
                    panelRefs.current.images = el;
                  }}
                >
                  <button
                    type="button"
                    className="blog-writer-accordion__header"
                    onClick={() => togglePanel('images')}
                  >
                    <div>
                      <p className="eyebrow">Images</p>
                      <span className="muted">
                        {imagesLoading ? 'Loading...' : `${generatedImages.length} attached`}
                        {useImages ? ' • will publish' : ''}
                      </span>
                    </div>
                    <FiChevronDown aria-hidden className={clsx(activePanel === 'images' && 'rotated')} />
                  </button>
                  <div
                    className="blog-writer-accordion__body"
                    ref={(el) => {
                      panelBodyRefs.current.images = el;
                    }}
                  >
                    {imagesError && <div className="blog-writer-alert">{imagesError}</div>}
                    {imagesLoading && <div className="blog-writer-images__placeholder">Loading images...</div>}
                    {!imagesLoading && generatedImages.length > 0 && (
                      <div className="blog-writer-images__grid">
                        {generatedImages.map((item) => (
                          <figure key={item.id} className="blog-writer-images__item">
                            <img src={item.image.url} alt={item.image.altText ?? 'Generated visual'} />
                            <figcaption>{item.image.altText || 'AI generated image'}</figcaption>
                          </figure>
                        ))}
                      </div>
                    )}
                    {!imagesLoading && generatedImages.length === 0 && !imagesError && (
                      <div className="blog-writer-images__placeholder">Images will appear here when generated.</div>
                    )}
                  </div>
                </div>
              )}

              {/* SEO */}
              {hasSeoInsights && (
                <div
                  className={clsx('blog-writer-accordion__item', activePanel === 'seo' && 'is-open')}
                  ref={(el) => {
                    panelRefs.current.seo = el;
                  }}
                >
                  <button type="button" className="blog-writer-accordion__header" onClick={() => togglePanel('seo')}>
                    <div>
                      <p className="eyebrow">SEO</p>
                      <span className="muted">Score {seoScore ?? '—'}</span>
                    </div>
                    <FiChevronDown aria-hidden className={clsx(activePanel === 'seo' && 'rotated')} />
                  </button>
                  <div
                    className="blog-writer-accordion__body"
                    ref={(el) => {
                      panelBodyRefs.current.seo = el;
                    }}
                  >
                    <div className="blog-writer-seo glass-card">
                      <div className="blog-writer-seo__score">
                        <span>SEO score</span>
                        <strong>{seoScore ?? '—'}</strong>
                      </div>
                      {seoHints.length > 0 && (
                        <ul className="blog-writer-seo__hints">
                          {seoHints.map((hint) => (
                            <li key={`${hint.type}-${hint.msg}`}>{hint.msg}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="blog-writer-chat glass-card">
          <div className="blog-writer-chat__messages" role="log" aria-live="polite">
            {messages.map((message) => (
              <div
                key={message.id}
                className={clsx('blog-writer-chat__message', `blog-writer-chat__message--${message.role}`)}
              >
                <div className="blog-writer-chat__bubble">
                  <span className="blog-writer-chat__timestamp">{message.timestamp}</span>
                  <p>{message.content}</p>
                </div>
              </div>
            ))}
          </div>

          <form className="blog-writer-chat__composer" onSubmit={handlePromptSubmit}>
            <Input
              label="Focus keyword"
              value={focusKeyword}
              onChange={(event) => {
                setFocusKeyword(event.target.value);
                if (formError) setFormError(null);
              }}
              placeholder="e.g. SaaS onboarding checklist"
            />
            {!selectedTopic && (
              <Textarea
                name="prompt"
                value={prompt}
                onChange={(event) => {
                  setPrompt(event.target.value);
                  if (formError) setFormError(null);
                }}
                placeholder="Describe the blog you need, tone, and audience..."
                rows={3}
              />
            )}
            {formError && <p className="blog-writer-chat__error">{formError}</p>}

            <div className="chat-options__group">
              <span className="chat-options__label">Social captions</span>
              <div className="chat-toggle-row">
                <button
                  type="button"
                  className={clsx('chip-toggle', includeInstagram && 'is-active')}
                  aria-pressed={includeInstagram}
                  onClick={() => setIncludeInstagram((prev) => !prev)}
                >
                  Instagram
                </button>
                <button
                  type="button"
                  className={clsx('chip-toggle', includeLinkedIn && 'is-active')}
                  aria-pressed={includeLinkedIn}
                  onClick={() => setIncludeLinkedIn((prev) => !prev)}
                >
                  LinkedIn
                </button>
              </div>
            </div>

            <div className="chat-options__group">
              <span className="chat-options__label">Images</span>
              <div className="chat-toggle-row">
                <button
                  type="button"
                  className={clsx('chip-toggle', includeImage && 'is-active')}
                  aria-pressed={includeImage}
                  onClick={() => setIncludeImage((prev) => !prev)}
                >
                  Blog/Featured
                </button>
                <button
                  type="button"
                  className={clsx('chip-toggle', includeLinkedInImage && 'is-active')}
                  aria-pressed={includeLinkedInImage}
                  onClick={() => setIncludeLinkedInImage((prev) => !prev)}
                >
                  LinkedIn image
                </button>
                <button
                  type="button"
                  className={clsx('chip-toggle', includeInstagramImage && 'is-active')}
                  aria-pressed={includeInstagramImage}
                  onClick={() => setIncludeInstagramImage((prev) => !prev)}
                >
                  Instagram image
                </button>
              </div>
              <Input
                label="Image prompt"
                value={imagePrompt}
                onChange={(e) => setImagePrompt(e.target.value)}
                placeholder="Optional image direction"
              />
            </div>

            <Button type="submit" rightIcon={<FiSend />} isLoading={isGenerating} disabled={isGenerating}>
              {isGenerating ? 'Generating...' : 'Send Prompt'}
            </Button>
          </form>
        </section>
      </main>

      <Modal
        open={publishModalOpen}
        title="Publish or schedule"
        onClose={() => setPublishModalOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPublishModalOpen(false)}>
              Close
            </Button>
            <Button variant="secondary" onClick={handlePublishNow} isLoading={publishing} disabled={!integrations.length}>
              Publish now
            </Button>
            <Button
              onClick={handleSchedule}
              leftIcon={<FiSend />}
              isLoading={publishing}
              disabled={!integrations.length || !scheduledTime}
            >
              Schedule
            </Button>
          </>
        }
      >
        {!integrations.length && (
          <div className="blog-writer-publish-empty">
            No integrations found. Connect one from Settings → Integrations, then come back to publish.
          </div>
        )}

        {integrations.length > 0 && (
          <div className="blog-writer-publish-form">
            <Select
              label="Integration"
              value={selectedIntegrationId}
              onChange={(e) => {
                const idVal = e.target.value;
                setSelectedIntegrationId(idVal);
                const found = integrations.find((i) => i.id === idVal);
                if (found) setSelectedPlatform(found.platform);
              }}
              options={integrations.map((i) => ({
                label: `${i.platform} • ${i.id.slice(0, 6)}`,
                value: i.id
              }))}
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
            <label className="blog-writer-checkbox blog-writer-checkbox--spaced">
              <input
                type="checkbox"
                checked={useImages}
                onChange={(e) => setUseImages(e.target.checked)}
                disabled={generatedImages.length === 0}
              />
              <span>{generatedImages.length === 0 ? 'No images available' : 'Publish with images'}</span>
            </label>
            {useImages && generatedImages.length > 0 && (
              <p className="blog-writer-publish-hint">
                We will attach the featured image (and Instagram image if available) automatically.
              </p>
            )}
            {publishError && <div className="blog-writer-alert">{publishError}</div>}
          </div>
        )}
      </Modal>
    </div>
  );
}
