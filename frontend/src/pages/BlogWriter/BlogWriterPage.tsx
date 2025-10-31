import { useEffect, useRef, useState, type FormEvent } from 'react';
import { clsx } from 'clsx';
import { FiCheck, FiCopy, FiImage, FiSend } from 'react-icons/fi';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import './blogWriter.css';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
};

type ViewMode = 'html' | 'plain';

const languageOptions = [
  { label: 'English', value: 'en' },
  { label: 'German', value: 'de' },
  { label: 'Spanish', value: 'es' },
  { label: 'French', value: 'fr' },
  { label: 'Italian', value: 'it' }
];

const sampleBlogHtml = `<article>
  <h1>How to Craft an SEO-Ready Blog Post That Actually Ranks</h1>
  <p>Publishing frequently is not enough. The blogs that win search traffic today are intentional about keyword alignment, search intent, and on-page experience. This guide walks through a repeatable framework you can reuse for every post.</p>
  <h2>1. Lead with a search-focused outline</h2>
  <ul>
    <li>Start with a primary keyword mapped to your business goal.</li>
    <li>Add supporting keywords that answer follow-up questions.</li>
    <li>Group related ideas into scannable sections with descriptive H2s.</li>
  </ul>
  <h2>2. Write for the reader first</h2>
  <p>Answer the question quickly, promise value, and highlight the unique angle you bring. Format for skim readers with short paragraphs, bullets, and descriptive subheadings.</p>
  <h2>3. Optimize on-page signals</h2>
  <p>Include a compelling meta description, compress image assets, and link to two to three trusted external sources. Close with a clear call-to-action and an internal link to a conversion page.</p>
</article>`;

const sampleBlogPlain = `Title: How to Craft an SEO-Ready Blog Post That Actually Ranks

Introduction:
Publishing frequently is not enough. To attract organic traffic you need posts that match search intent, answer follow-up questions, and provide a satisfying reader experience.

Section 1 - Lead with a search-focused outline:
- Pick one primary keyword that maps to your business goal.
- Layer in secondary keywords that cover related questions.
- Organize the outline into short sections with helpful, descriptive headings.

Section 2 - Write for the reader first:
Answer the core question in the opening, promise value, and highlight the unique angle you bring. Keep paragraphs short, incorporate bullets, and use transition phrases to keep readers engaged.

Section 3 - Optimize on-page signals:
Craft a clear meta description, compress images, link to credible sources, and direct readers to a relevant conversion page within your site. Encourage action with a compelling CTA.`;

const sampleInstagramCaption =
  'New blog drop: the playbook we use to publish SEO-ready posts that actually rank. Swipe to grab the outline template and save this for your next content sprint. #ContentMarketing #SEOtips';

const sampleLinkedinDescription =
  'We just published a practical walkthrough on building SEO-first blog posts: keyword mapping, outlining fast, on-page optimizations, and CTAs that move the needle. Perfect for marketers tightening their organic strategy this quarter.';

function getTimestamp() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function BlogWriterPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('html');
  const [language, setLanguage] = useState(languageOptions[0].value);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'assistant-welcome',
      role: 'assistant',
      content:
        'Tell me about the topic, keywords, tone, and any calls-to-action. I will shape an SEO-ready blog post for you.',
      timestamp: getTimestamp()
    }
  ]);
  const [blogHtml, setBlogHtml] = useState('');
  const [blogPlain, setBlogPlain] = useState('');
  const [instagramCopy, setInstagramCopy] = useState('');
  const [linkedinCopy, setLinkedinCopy] = useState('');
  const [includeInstagram, setIncludeInstagram] = useState(true);
  const [includeLinkedIn, setIncludeLinkedIn] = useState(true);
  const [copyMode, setCopyMode] = useState<'idle' | 'copied'>('idle');
  const copyResetTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyResetTimer.current) {
        window.clearTimeout(copyResetTimer.current);
      }
    };
  }, []);

  const handlePromptSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!prompt.trim()) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: prompt.trim(),
      timestamp: getTimestamp()
    };

    setMessages((prev) => [...prev, userMessage]);
    setPrompt('');
    setIsGenerating(true);

    window.setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content:
            "Here's a fresh draft aligned to your prompt. Feel free to tweak the keywords or ask for a different angle.",
          timestamp: getTimestamp()
        }
      ]);

      setBlogHtml(sampleBlogHtml);
      setBlogPlain(sampleBlogPlain);
      setInstagramCopy(includeInstagram ? sampleInstagramCaption : '');
      setLinkedinCopy(includeLinkedIn ? sampleLinkedinDescription : '');
      setIsGenerating(false);
    }, 600);
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
      // Clipboard failures can be surfaced once backend integration is in place.
    }
  };

  const hasBlogDraft = Boolean(blogHtml || blogPlain);

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
            onChange={(event) => setLanguage(event.target.value)}
            options={languageOptions}
          />
          <Button type="button" variant="secondary" leftIcon={<FiImage />}>
            Generate Image with AI
          </Button>
        </div>
      </header>

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
              <span className={clsx('blog-writer-switch-label', viewMode === 'plain' && 'is-active')}>Readable</span>
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
                        if (!instagramCopy) return;
                        try {
                          if ('clipboard' in navigator) {
                            await navigator.clipboard.writeText(instagramCopy);
                          }
                        } catch {
                          // Clipboard failures can be surfaced once backend integration is in place.
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
                        if (!linkedinCopy) return;
                        try {
                          if ('clipboard' in navigator) {
                            await navigator.clipboard.writeText(linkedinCopy);
                          }
                        } catch {
                          // Clipboard failures can be surfaced once backend integration is in place.
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
            <Textarea
              name="prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Describe the blog you need, target keywords, tone, and audience..."
              rows={4}
            />
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
