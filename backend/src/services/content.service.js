import { prisma } from '../lib/prisma.js';
import { sanitizeContentRecord, sanitizeContentHtml } from '../utils/html-content.js';


export const ContentService = {
async listByUser(userId) {
const items = await prisma.content.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
return items.map(sanitizeContentRecord);
},


async createDraft(userId, payload) {
const normalizedHtml = payload.html ? sanitizeContentHtml(payload.html) : payload.html || null;
return prisma.content.create({
data: {
userId,
platform: payload.platform,
language: payload.language,
topicId: payload.topicId || null,
title: payload.title,
html: normalizedHtml,
text: payload.text || null,
 metaDescription: payload.metaDescription || null,
 primaryKeyword: payload.primaryKeyword || null,
 secondaryKeywords: Array.isArray(payload.secondaryKeywords) ? payload.secondaryKeywords : [],
 seoMeta: payload.seoMeta || null,
 seoSummary: payload.seoSummary || null,
 grammarScore: payload.grammarScore ?? null,
 readabilityScore: payload.readabilityScore ?? null,
 ragScore: payload.ragScore ?? null,
 aiMeta: payload.aiMeta || null,
 status: 'DRAFT'
}
});
},


async getByIdOwned(id, userId) {
const c = await prisma.content.findUnique({ where: { id } });
if (!c || c.userId !== userId) return null;
return sanitizeContentRecord(c);
},


async updateOwned(id, userId, data) {
const owned = await this.getByIdOwned(id, userId);
if (!owned) return null;
const normalizedData = {
...data,
...(data?.html !== undefined ? { html: data.html ? sanitizeContentHtml(data.html) : data.html } : {})
};
return prisma.content.update({
where: { id },
data: normalizedData
});
}
};
