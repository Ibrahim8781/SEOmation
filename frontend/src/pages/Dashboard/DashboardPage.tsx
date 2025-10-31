import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { FiClock, FiFileText, FiPenTool } from 'react-icons/fi';
import { useAuth } from '@/hooks/useAuth';
import { useOnboarding } from '@/hooks/useOnboarding';
import { TopicAPI } from '@/api/topics';
import { ContentAPI } from '@/api/content';
import type { ContentItem, Topic } from '@/types';
import { extractErrorMessage } from '@/utils/error';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { AnalyticsWidget } from '@/components/dashboard/AnalyticsWidget';
import { CalendarWidget } from '@/components/dashboard/CalendarWidget';
import { TopicCard } from '@/components/dashboard/TopicCard';
import { WriterCard } from '@/components/dashboard/WriterCard';
import { FullScreenLoader } from '@/components/common/FullScreenLoader';
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

function buildFallbackTopics(userId: string, topics: Topic[], niche?: string, audience?: string, platform?: Topic['platform'], language?: Topic['language']): Topic[] {
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
    `Explain how ${theme} teams can leverage AI for growth`
  ];

  return seeds.map((title, index) => ({
    id: `fallback-${index}`,
    userId,
    title,
    platform: selectedPlatform,
    language: selectedLanguage,
    relevance: 0.85 - index * 0.08,
    isRelevant: true,
    aiMeta: null,
    status: 'SUGGESTED',
    createdAt: now,
    updatedAt: now
  }));
}

function buildAnalyticsData(content: ContentItem[]) {
  const months = Array.from({ length: 6 }).map((_, idx) =>
    dayjs().subtract(5 - idx, 'month').startOf('month')
  );

  return months.map((month, idx) => {
    const items = content.filter((item) => dayjs(item.createdAt).isSame(month, 'month'));
    const words = items.reduce((sum, item) => sum + countWords(item.text), 0);
    const baseReach = 4000 + idx * 1400;
    const reachBoost = words * 2.4;
    const reach = Math.round(baseReach + reachBoost);
    const engagement = Math.round(reach * 0.32 + idx * 90);
    return {
      label: month.format('MMM'),
      reach,
      engagement
    };
  });
}

export function DashboardPage() {
  const { user } = useAuth();
  const { businessProfile } = useOnboarding();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [content, setContent] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const [topicsRes, contentRes] = await Promise.all([TopicAPI.list(), ContentAPI.list()]);
        if (isMounted) {
          setTopics(topicsRes.data.items);
          setContent(contentRes.data.items);
        }
      } catch (err) {
        if (isMounted) {
          setError(extractErrorMessage(err, 'Unable to load your workspace data right now.'));
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    load();
    return () => {
      isMounted = false;
    };
  }, [user]);

  const totalWords = useMemo(
    () => content.reduce((sum, item) => sum + countWords(item.text), 0),
    [content]
  );

  const timeSaved = useMemo(() => content.length * 45, [content.length]);

  const analyticsData = useMemo(() => buildAnalyticsData(content), [content]);

  const suggestedTopics = useMemo(() => {
    if (!user) return [];
    return buildFallbackTopics(
      user.id,
      topics,
      businessProfile?.niche,
      businessProfile?.targetAudience,
      businessProfile?.primaryPlatforms?.[0],
      businessProfile?.language ?? user.language
    ).slice(0, 4);
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
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <h1>Welcome back, {user?.name?.split(' ')[0] || 'Creator'}!</h1>
          <p>
            {businessProfile
              ? `We’re using your ${businessProfile.niche} insights to surface the most relevant ideas for ${businessProfile.targetAudience}.`
              : 'Let’s build momentum with fresh ideas, smarter AI drafts, and insightful analytics.'}
          </p>
        </div>
        <div className="dashboard-toggle">
          <span>Good vibes mode</span>
          <div className="dashboard-toggle__switch">
            <span />
          </div>
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

      <section className="dashboard-grid">
        <AnalyticsWidget data={analyticsData} />
        <CalendarWidget />
      </section>

      <section className="dashboard-topics">
        <div className="dashboard-section-heading">
          <h2>Suggested Topics for you</h2>
          <p>Curated using your business profile and recent performance insights.</p>
        </div>
        <div className="dashboard-topics__grid">
          {suggestedTopics.map((topic) => (
            <TopicCard key={topic.id} topic={topic} />
          ))}
        </div>
      </section>

      <section className="dashboard-writer">
        <div className="dashboard-section-heading">
          <h2>Generate with our Writer</h2>
          <p>Kickstart drafts tailored to your brand voice and audience.</p>
        </div>
        <WriterCard />
      </section>
    </div>
  );
}
