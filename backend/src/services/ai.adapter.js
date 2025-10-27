import axios from 'axios';
import { config } from '../config/index.js';


function mockTopics({ platform, language, context }) {
const base = context?.niche || 'SEO';
return [
{ title: `${base} content strategy for 2025`, relevance: 0.92, isRelevant: true },
{ title: `Beginner's guide to programmatic ${base}`, relevance: 0.87, isRelevant: true },
{ title: `Mistakes to avoid in ${base}`, relevance: 0.79, isRelevant: true }
].map((t) => ({ ...t, platform, language, aiMeta: { mock: true } }));
}


function mockContent({ platform, language, topicTitle, prompt }) {
const title = topicTitle || `Draft: ${prompt?.slice(0, 40)}`;
const text = `# ${title}\n\nThis is a mocked ${platform} draft in ${language}.\n- Intro\n- Key points\n- CTA`;
const html = `<h1>${title}</h1><p>This is a mocked ${platform} draft in ${language}.</p>`;
return {
title,
text,
html,
grammarScore: 0.95,
readabilityScore: 0.8,
ragScore: 0.9,
seoMeta: { keywords: ['seo', 'automation'] },
aiMeta: { mock: true }
};
}


export const AiAdapter = {
async generateTopics(payload) {
if (config.ai.mock || !config.ai.url) {
return mockTopics(payload);
}
const { data } = await axios.post(`${config.ai.url}/topics/generate`, payload, {
headers: { 'x-api-key': process.env.AI_API_KEY || '' }
});
return data.topics;
},


async generateContent(payload) {
if (config.ai.mock || !config.ai.url) {
return mockContent(payload);
}
const { data } = await axios.post(`${config.ai.url}/content/generate`, payload, {
headers: { 'x-api-key': process.env.AI_API_KEY || '' }
});
return data;
}
};