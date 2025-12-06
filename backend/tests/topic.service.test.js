import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Import after mocking in setup.js
const { TopicService } = await import('../src/services/topic.service.js');

describe('TopicService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listByUser', () => {
    it('should return all topics for a user ordered by createdAt desc', async () => {
      const userId = 'user-123';
      const mockTopics = [
        { 
          id: 'topic-1', 
          userId, 
          title: 'Topic 1', 
          createdAt: new Date('2024-01-02'),
          status: 'SUGGESTED'
        },
        { 
          id: 'topic-2', 
          userId, 
          title: 'Topic 2', 
          createdAt: new Date('2024-01-01'),
          status: 'SUGGESTED'
        }
      ];

      global.mockPrisma.topic.findMany.mockResolvedValue(mockTopics);

      const result = await TopicService.listByUser(userId);

      expect(global.mockPrisma.topic.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { createdAt: 'desc' }
      });
      expect(result).toEqual(mockTopics);
      expect(result).toHaveLength(2);
    });

    it('should return empty array if user has no topics', async () => {
      global.mockPrisma.topic.findMany.mockResolvedValue([]);

      const result = await TopicService.listByUser('user-123');

      expect(result).toEqual([]);
    });
  });

  describe('createManyFromAi', () => {
    it('should delete old SUGGESTED topics and create new ones', async () => {
      const userId = 'user-123';
      const platform = 'BLOG';
      const language = 'EN';
      const items = [
        { 
          title: 'SEO Best Practices', 
          rationale: 'High search volume', 
          targetKeyword: 'seo tips',
          trendTag: 'rising'
        },
        { 
          title: 'Content Marketing', 
          rationale: 'Trending topic', 
          targetKeyword: 'content marketing',
          trendTag: 'stable'
        }
      ];

      const mockCreated = items.map((item, idx) => ({
        id: `topic-${idx}`,
        userId,
        platform,
        language,
        ...item,
        status: 'SUGGESTED',
        createdAt: new Date()
      }));

      global.mockPrisma.topic.deleteMany.mockResolvedValue({ count: 5 });
      global.mockPrisma.topic.createMany.mockResolvedValue({ count: 2 });
      global.mockPrisma.topic.findMany.mockResolvedValue(mockCreated);

      const result = await TopicService.createManyFromAi(userId, platform, language, items);

      expect(global.mockPrisma.topic.deleteMany).toHaveBeenCalledWith({
        where: { userId, status: 'SUGGESTED' }
      });
      expect(global.mockPrisma.topic.createMany).toHaveBeenCalled();
      expect(result).toEqual(mockCreated);
    });

    it('should return existing topics if items array is empty', async () => {
      const userId = 'user-123';
      const mockExisting = [
        { id: 'topic-1', userId, title: 'Existing Topic', status: 'SUGGESTED' }
      ];

      global.mockPrisma.topic.findMany.mockResolvedValue(mockExisting);

      const result = await TopicService.createManyFromAi(userId, 'BLOG', 'EN', []);

      expect(global.mockPrisma.topic.deleteMany).not.toHaveBeenCalled();
      expect(global.mockPrisma.topic.createMany).not.toHaveBeenCalled();
      expect(result).toEqual(mockExisting);
    });

    it('should handle null items parameter', async () => {
      const mockExisting = [];
      global.mockPrisma.topic.findMany.mockResolvedValue(mockExisting);

      const result = await TopicService.createManyFromAi('user-123', 'BLOG', 'EN', null);

      expect(result).toEqual(mockExisting);
    });
  });
});