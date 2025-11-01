import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { clsx } from 'clsx';
import { FiCheck, FiCopy, FiImage, FiSend, FiX } from 'react-icons/fi';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/hooks/useAuth';
import { useOnboarding } from '@/hooks/useOnboarding';
import { ContentAPI, type GenerateContentPayload, type SeoHint } from '@/api/content';
import type { Topic } from '@/types';
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

function getTimestamp() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function BlogWriterPage() {
  const location = useLocation();
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
  const [seoScore, setSeoScore] = useState<number | null>(null);
  const [seoHints, setSeoHints] = useState<SeoHint[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [copyMode, setCopyMode] = useState<'idle' | 'copied'>('idle');
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
      includeLinkedIn
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
      setBlogHtml(data.item.html ?? '');
      setBlogPlain(data.item.text ?? '');
      setLanguage(data.item.language as 'EN' | 'DE');
      setSeoScore(data.seo?.score ?? null);
      setSeoHints(data.seo?.hints ?? []);
      setInstagramCopy(includeInstagram ? variants.instagram?.text ?? '' : '');
      setLinkedinCopy(includeLinkedIn ? variants.linkedin?.text ?? '' : '');
      setFocusKeyword(data.focusKeyword);
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

  const hasBlogDraft = Boolean(blogHtml || blogPlain);
  const hasSeoInsights = seoScore !== null || seoHints.length > 0;

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
          <Button type="button" variant="secondary" leftIcon={<FiImage />}>
            Generate Image with AI
          </Button>
        </div>
      </header>

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
          <div className="blog-writer-output__toolbar">
            <div className="blog-writer-output__switch">
              <span className={clsx('blog-writer-switch-label', viewMode === 'html' && 'is-active')}>HTML</span>
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

            <Button
              type="button"
              variant="ghost"
              onClick={handleCopy}
              leftIcon={copyMode === 'copied' ? <FiCheck /> : <FiCopy />}
              disabled={!hasBlogDraft}
            >
              {copyMode === 'copied' ? 'Copied' : 'Copy Draft'}
            </Button>
          </div>

          {apiError && <div className="blog-writer-alert">{apiError}</div>}

          <div className="blog-writer-output__content">
            {!hasBlogDraft && (
              <div className="blog-writer-output__placeholder">
                <p>Your SEO-ready draft will appear here in HTML or plain language after you send a prompt.</p>
              </div>
            )}

            {hasBlogDraft && viewMode === 'html' && (
              <pre className="blog-writer-output__code">{blogHtml}</pre>
            )}

            {hasBlogDraft && viewMode === 'plain' && (
              <article className="blog-writer-output__article">
                {blogPlain.split('\n\n').map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </article>
            )}
          </div>

          {hasSeoInsights && (
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
          )}

          {(includeInstagram || includeLinkedIn) && hasBlogDraft && (
            <div className="blog-writer-snippets">
              {includeInstagram && instagramCopy && (
                <div className="blog-writer-snippet">
                  <header>
                    <span>Instagram Caption</span>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={async () => {
                        try {
                          if ('clipboard' in navigator) {
                            await navigator.clipboard.writeText(instagramCopy);
                          }
                        } catch {
                          // clipboard failure ignored for now
                        }
                      }}
                      leftIcon={<FiCopy />}
                    >
                      Copy
                    </Button>
                  </header>
                  <p>{instagramCopy}</p>
                </div>
              )}

              {includeLinkedIn && linkedinCopy && (
                <div className="blog-writer-snippet">
                  <header>
                    <span>LinkedIn Description</span>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={async () => {
                        try {
                          if ('clipboard' in navigator) {
                            await navigator.clipboard.writeText(linkedinCopy);
                          }
                        } catch {
                          // clipboard failure ignored for now
                        }
                      }}
                      leftIcon={<FiCopy />}
                    >
                      Copy
                    </Button>
                  </header>
                  <p>{linkedinCopy}</p>
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
                placeholder="Describe the blog you need, target keywords, tone, and audience..."
                rows={4}
              />
            )}
            {formError && <p className="blog-writer-chat__error">{formError}</p>}
            <div className="blog-writer-chat__options">
              <label className="blog-writer-checkbox">
                <input
                  type="checkbox"
                  checked={includeInstagram}
                  onChange={(event) => setIncludeInstagram(event.target.checked)}
                />
                <span>Include Instagram caption</span>
              </label>
              <label className="blog-writer-checkbox">
                <input
                  type="checkbox"
                  checked={includeLinkedIn}
                  onChange={(event) => setIncludeLinkedIn(event.target.checked)}
                />
                <span>Include LinkedIn description</span>
              </label>
            </div>
            <Button type="submit" rightIcon={<FiSend />} isLoading={isGenerating} disabled={isGenerating}>
              {isGenerating ? 'Generating...' : 'Send Prompt'}
            </Button>
          </form>
        </section>
      </main>
    </div>
  );
}
