import { prisma } from '../lib/prisma.js';


export const ContentService = {
async listByUser(userId) {
return prisma.content.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
},


async createDraft(userId, payload) {
return prisma.content.create({
data: {
userId,
platform: payload.platform,
language: payload.language,
topicId: payload.topicId || null,
title: payload.title,
html: payload.html || null,
text: payload.text || null,
seoMeta: payload.seoMeta || null,
grammarScore: payload.grammarScore || null,
readabilityScore: payload.readabilityScore || null,
ragScore: payload.ragScore || null,
aiMeta: payload.aiMeta || null,
status: 'DRAFT'
}
});
},


async getByIdOwned(id, userId) {
const c = await prisma.content.findUnique({ where: { id } });
if (!c || c.userId !== userId) return null;
return c;
},


async updateOwned(id, userId, data) {
const owned = await this.getByIdOwned(id, userId);
if (!owned) return null;
return prisma.content.update({
where: { id },
data
});
}
};