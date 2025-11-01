import { prisma } from '../lib/prisma.js';


export const TopicService = {
async listByUser(userId) {
return prisma.topic.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
},


async createManyFromAi(userId, platform, language, items) {
if (!Array.isArray(items) || items.length === 0) {
return prisma.topic.findMany({
where: { userId, status: 'SUGGESTED' },
orderBy: { createdAt: 'desc' },
take: 12
});
}

await prisma.topic.deleteMany({
where: { userId, status: 'SUGGESTED' }
});

const data = items.map((t) => {
const aiMeta = t.aiMeta ? { ...t.aiMeta } : {};
if (t.trendTag && !aiMeta.trendTag) {
aiMeta.trendTag = t.trendTag;
}
if (t.rationale && !aiMeta.rationale) {
aiMeta.rationale = t.rationale;
}
return {
userId,
title: t.title,
platform: t.platform ?? platform,
language: t.language ?? language,
targetKeyword: t.targetKeyword ?? null,
rationale: t.rationale ?? null,
relevance: t.relevance ?? null,
isRelevant: t.isRelevant ?? null,
aiMeta: Object.keys(aiMeta).length ? aiMeta : null
};
});

await prisma.topic.createMany({ data });

return prisma.topic.findMany({
where: { userId, status: 'SUGGESTED' },
orderBy: { createdAt: 'desc' },
take: data.length
});
}
};
