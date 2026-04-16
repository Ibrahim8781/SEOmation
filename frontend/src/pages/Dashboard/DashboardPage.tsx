import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiClock, FiFileText, FiPenTool, FiRefreshCw } from 'react-icons/fi';
import { useAuth } from '@/hooks/useAuth';
import { useOnboarding } from '@/hooks/useOnboarding';
import { TopicAPI } from '@/api/topics';
import { ContentAPI } from '@/api/content';
import { ScheduleAPI } from '@/api/schedule';
import type { ContentItem, ScheduleJob, Topic } from '@/types';
import { extractErrorMessage } from '@/utils/error';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { CalendarWidget } from '@/components/dashboard/CalendarWidget';
import { TopicCard } from '@/components/dashboard/TopicCard';
import { WriterCard } from '@/components/dashboard/WriterCard';
import { FullScreenLoader } from '@/components/common/FullScreenLoader';
import { Button } from '@/components/ui/Button';
import { formatScheduledDateKey } from '@/utils/scheduleTime';
import { TOPIC_SUGGESTION_COUNT } from '@/utils/topicLimits';
import './dashboard.css';

const numberFormatter = Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1
});

function formatTimeSaved(minutes: number): string {
  if (minutes <= 0) return '0 min';
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (hours && remaining) return `${hours}h ${remaining}m`;
  if (hours) return `${hours}h`;
  return `${remaining} min`;
}

function countWords(text?: string | null): number {
  if (!text) return 0;
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function buildFallbackTopics(
  userId: string,
  topics: Topic[],
  niche?: string,
  audience?: string,
  platform?: Topic['platform'],
  language?: Topic['language']
): Topic[] {
  if (topics.length > 0) return topics;
  const selectedPlatform = platform ?? 'BLOG';
  const selectedLanguage = language ?? 'EN';
  const now = new Date().toISOString();
  const descriptors = audience ?? 'your audience';
  const theme = niche ?? 'your niche';

  const seeds = [
    `Write a helpful guide on onboarding new ${theme} users`,
    `Map a content strategy on educating ${descriptors}`,
    `Share mistakes to avoid when scaling ${theme} marketing`,
    `Explain how ${theme} teams can leverage AI for growth`,
    `Build a seasonal campaign angle for ${theme} buyers`,
    `React to the latest market shift affecting ${theme} teams`
  ];

  return seeds.map((title, index) => ({
    id: `fallback-${index}`,
    userId,
    title,
    platform: selectedPlatform,
    language: selectedLanguage,
    relevance: 0.85 - index * 0.08,
    isRelevant: true,
    targetKeyword: title.toLowerCase().split(' ').slice(0, 3).join(' '),
    rationale: `Suggested to engage ${descriptors} within ${theme}.`,
    aiMeta: {
      trendTag: index >= 5 ? 'news-angle' : index >= 4 ? 'seasonal-campaign' : 'evergreen',
      source: 'fallback'
    },
    status: 'SUGGESTED',
    createdAt: now,
    updatedAt: now
  }));
}

export function DashboardPage() {
  const { user } = useAuth();
  const { businessProfile } = useOnboarding();
  const navigate = useNavigate();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [content, setContent] = useState<ContentItem[]>([]);
  const [jobs, setJobs] = useState<ScheduleJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatingTopics, setGeneratingTopics] = useState(false);
  const [topicGenerationError, setTopicGenerationError] = useState<string | null>(null);
  const [attemptedAutoGenerate, setAttemptedAutoGenerate] = useState(false);

  useEffect(() => {
    setAttemptedAutoGenerate(false);
  }, [businessProfile]);

  const loadWorkspace = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [topicsRes, contentRes, jobsRes] = await Promise.all([
        TopicAPI.list(),
        ContentAPI.list(),
        ScheduleAPI.list()
      ]);
      setTopics(topicsRes.data.items);
      setContent(contentRes.data.items);
      setJobs(jobsRes.data.items);
      setTopicGenerationError(null);
      setAttemptedAutoGenerate(topicsRes.data.items.length > 0);
    } catch (err) {
      setError(extractErrorMessage(err, 'Unable to load your workspace data right now.'));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  const generateTopics = useCallback(async () => {
    if (!user || !businessProfile) return;
    setTopicGenerationError(null);
    setGeneratingTopics(true);
    try {
      const platform = businessProfile.primaryPlatforms?.[0] ?? 'BLOG';
      const language = businessProfile.language ?? user.language;
      const context = {
        businessName: businessProfile.businessName,
        niche: businessProfile.niche ?? user.niche,
        audience: businessProfile.targetAudience,
        tone: businessProfile.toneOfVoice ?? user.tone,
        seedKeywords: businessProfile.seedKeywords,
        pains: businessProfile.audiencePainPoints,
        region: businessProfile.primaryRegion,
        season: businessProfile.seasonalFocus,
        contentGoals: businessProfile.contentGoals,
        preferredContentTypes: businessProfile.preferredContentTypes,
        includeTrends: businessProfile.includeTrends,
        count: TOPIC_SUGGESTION_COUNT
      };

      const { data } = await TopicAPI.generate({
        platform,
        language,
        context
      });
      setTopics(data.items);
      setTopicGenerationError(null);
    } catch (err) {
      setTopicGenerationError(
        extractErrorMessage(err, 'Unable to refresh topic suggestions right now.')
      );
    } finally {
      setGeneratingTopics(false);
    }
  }, [businessProfile, user]);

  useEffect(() => {
    if (
      !loading &&
      businessProfile &&
      topics.length === 0 &&
      !generatingTopics &&
      !attemptedAutoGenerate
    ) {
      setAttemptedAutoGenerate(true);
      generateTopics();
    }
  }, [loading, businessProfile, topics.length, generatingTopics, attemptedAutoGenerate, generateTopics]);

  const handleTopicSelect = useCallback(
    (topic: Topic) => {
      navigate('/writer', { state: { topic } });
    },
    [navigate]
  );

  const totalWords = useMemo(
    () => content.reduce((sum, item) => sum + countWords(item.text), 0),
    [content]
  );

  const timeSaved = useMemo(() => content.length * 45, [content.length]);

  const scheduledDates = useMemo(
    () =>
      jobs
        .filter((job) => job.scheduledTime)
        .map((job) => formatScheduledDateKey(job.scheduledTime, job.scheduledTimezone || user?.timezone)),
    [jobs, user?.timezone]
  );

  const suggestedTopics = useMemo(() => {
    if (!user) return [];
    return buildFallbackTopics(
      user.id,
      topics,
      businessProfile?.niche,
      businessProfile?.targetAudience,
      businessProfile?.primaryPlatforms?.[0],
      businessProfile?.language ?? user.language
    ).slice(0, TOPIC_SUGGESTION_COUNT);
  }, [businessProfile, topics, user]);

  if (loading && !user) {
    return <FullScreenLoader message="Loading your dashboard..." />;
  }

  if (error) {
    return (
      <div className="dashboard-page">
        <div className="dashboard-error glass-card">
          <h2>We hit a snag</h2>
          <p>{error}</p>
          <Button variant="secondary" onClick={loadWorkspace}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div className="dashboard-header__copy">
          <h1>Welcome back, {user?.name?.split(' ')[0] || 'Creator'}!</h1>
          <p>
            {businessProfile
              ? `We're using your ${businessProfile.niche} insights to surface the most relevant ideas for ${businessProfile.targetAudience}.`
              : "Let's build momentum with fresh ideas and smarter AI drafts."}
          </p>
        </div>
      </header>

      <section className="dashboard-metrics">
        <MetricCard
          label="Words Generated"
          value={numberFormatter.format(totalWords)}
          icon={<FiPenTool />}
          accent="blue"
        />
        <MetricCard
          label="Content Created"
          value={numberFormatter.format(content.length)}
          icon={<FiFileText />}
          accent="pink"
        />
        <MetricCard
          label="Time Saved"
          value={formatTimeSaved(timeSaved)}
          icon={<FiClock />}
          accent="purple"
        />
      </section>
      {content.length === 0 && (
        <p className="dashboard-metrics__hint">
          Start generating content to see your analytics here.
        </p>
      )}

      <section className="dashboard-feature">
        <div className="dashboard-section-heading dashboard-section-heading--writer">
          <div>
            <h2>Generate with our Writer</h2>
            <p>Kickstart drafts tailored to your brand voice and audience.</p>
          </div>
        </div>
        <div className="dashboard-feature__grid">
          <WriterCard />
          <CalendarWidget
            scheduledDates={scheduledDates}
            onDateClick={() => navigate('/schedule')}
          />
        </div>
      </section>

      <section className="dashboard-topics">
        <div className="dashboard-section-heading">
          <div className="dashboard-section-heading__content">
            <div className="dashboard-section-heading__title-row">
              <h2>Suggested Topics for you</h2>
              {generatingTopics && (
                <span className="dashboard-inline-refresh">
                  <FiRefreshCw />
                  Refreshing...
                </span>
              )}
            </div>
            <p>Curated using your business profile and recent performance insights.</p>
          </div>
          {businessProfile && (
            <Button
              type="button"
              variant="ghost"
              className="dashboard-refresh-btn"
              leftIcon={<FiRefreshCw />}
              disabled={generatingTopics}
              onClick={() => {
                setAttemptedAutoGenerate(true);
                generateTopics();
              }}
            >
              Refresh topics
            </Button>
          )}
        </div>
        {topicGenerationError && (
          <p className="dashboard-topics__error">{topicGenerationError}</p>
        )}
        <div className="dashboard-topics__grid">
          {suggestedTopics.map((topic) => (
            <TopicCard key={topic.id} topic={topic} onSelect={handleTopicSelect} />
          ))}
        </div>
      </section>
    </div>
  );
}
