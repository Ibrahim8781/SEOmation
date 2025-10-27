import { AiAdapter } from '../services/ai.adapter.js';
import { TopicService } from '../services/topic.service.js';


export const TopicController = {
async generate(req, res, next) {
try {
const { platform, language, context } = req.body;
const topics = await AiAdapter.generateTopics({ platform, language, context });
const saved = await TopicService.createManyFromAi(req.user.id, platform, language, topics);
res.json({ items: saved });
} catch (e) { next(e); }
},
async list(req, res, next) {
try {
const items = await TopicService.listByUser(req.user.id);
res.json({ items });
} catch (e) { next(e); }
}
};