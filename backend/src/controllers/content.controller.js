import { AiAdapter } from '../services/ai.adapter.js';
import { ContentService } from '../services/content.service.js';
import ApiError from '../utils/ApiError.js';
import { HTTP } from '../utils/httpStatus.js';


export const ContentController = {
async generate(req, res, next) {
try {
const { platform, language, topicId, prompt } = req.body;
let topicTitle = null;
if (topicId) {
const topic = await import('../lib/prisma.js').then(({ prisma }) =>
prisma.topic.findUnique({ where: { id: topicId } })
);
if (!topic || topic.userId !== req.user.id) throw new ApiError(404, 'Topic not found');
topicTitle = topic.title;
}
const draft = await AiAdapter.generateContent({ platform, language, topicTitle, prompt });
const saved = await ContentService.createDraft(req.user.id, { ...draft, platform, language, topicId });
res.status(HTTP.CREATED).json(saved);
} catch (e) { next(e); }
},


async list(req, res, next) {
try {
const items = await ContentService.listByUser(req.user.id);
res.json({ items });
} catch (e) { next(e); }
},


async getById(req, res, next) {
try {
const item = await ContentService.getByIdOwned(req.params.id, req.user.id);
if (!item) throw new ApiError(404, 'Not found');
res.json(item);
} catch (e) { next(e); }
},


async update(req, res, next) {
try {
const updated = await ContentService.updateOwned(req.params.id, req.user.id, req.body);
if (!updated) throw new ApiError(404, 'Not found');
res.json(updated);
} catch (e) { next(e); }
}
};