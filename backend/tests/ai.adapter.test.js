import { AiAdapter } from '../src/services/ai.adapter.js';


process.env.AI_MOCK = 'true';


describe('AI adapter (mock)', () => {
it('generates topics in mock mode', async () => {
const topics = await AiAdapter.generateTopics({ platform: 'BLOG', language: 'EN', context: { niche: 'SaaS SEO' } });
expect(Array.isArray(topics)).toBe(true);
expect(topics.length).toBeGreaterThan(0);
});


it('generates content in mock mode', async () => {
const draft = await AiAdapter.generateContent({ platform: 'BLOG', language: 'EN', topicTitle: 'Hello' });
expect(draft.title).toBeTruthy();
expect(draft.html).toContain('<h1>');
});
});