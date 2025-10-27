import { prisma } from '../lib/prisma.js';


export const TopicService = {
async listByUser(userId) {
return prisma.topic.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
},


async createManyFromAi(userId, platform, language, items) {
const data = items.map((t) => ({
userId,
title: t.title,
platform,
language,
relevance: t.relevance ?? null,
isRelevant: t.isRelevant ?? null,
aiMeta: t.aiMeta ?? null
}));
await prisma.topic.createMany({ data });
return prisma.topic.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: items.length });
}
};