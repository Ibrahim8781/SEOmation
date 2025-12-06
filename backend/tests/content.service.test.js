import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Import after mocking in setup.js
const { ContentService } = await import('../src/services/content.service.js');

describe('ContentService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listByUser', () => {
    it('should return all content for a user ordered by createdAt desc', async () => {
      const userId = 'user-123';
      const mockContent = [
        { 
          id: 'content-1', 
          userId, 
          title: 'Blog Post 1', 
          createdAt: new Date('2024-01-02'),
          status: 'DRAFT'
        },
        { 
          id: 'content-2', 
          userId, 
          title: 'Blog Post 2', 
          createdAt: new Date('2024-01-01'),
          status: 'PUBLISHED'
        }
      ];

      global.mockPrisma.content.findMany.mockResolvedValue(mockContent);

      const result = await ContentService.listByUser(userId);

      expect(global.mockPrisma.content.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { createdAt: 'desc' }
      });
      expect(result).toEqual(mockContent);
      expect(result).toHaveLength(2);
    });
  });

  describe('createDraft', () => {
    it('should create a draft with all provided fields', async () => {
      const userId = 'user-123';
      const payload = {
        platform: 'BLOG',
        language: 'EN',
        topicId: 'topic-1',
        title: 'Test Blog Post',
        html: '<p>This is test content</p>',
        text: 'This is test content',
        metaDescription: 'Test meta description',
        primaryKeyword: 'test keyword',
        secondaryKeywords: ['keyword1', 'keyword2']
      };

      const mockCreated = { 
        id: 'content-1', 
        ...payload, 
        userId, 
        status: 'DRAFT',
        createdAt: new Date()
      };

      global.mockPrisma.content.create.mockResolvedValue(mockCreated);

      const result = await ContentService.createDraft(userId, payload);

      expect(global.mockPrisma.content.create).toHaveBeenCalled();
      expect(result.id).toBe('content-1');
      expect(result.status).toBe('DRAFT');
      expect(result.title).toBe(payload.title);
    });
  });

  describe('getByIdOwned', () => {
    it('should return content if user owns it', async () => {
      const contentId = 'content-1';
      const userId = 'user-123';
      const mockContent = { id: contentId, userId, title: 'Test Content' };

      global.mockPrisma.content.findUnique.mockResolvedValue(mockContent);

      const result = await ContentService.getByIdOwned(contentId, userId);

      expect(result).toEqual(mockContent);
    });

    it('should return null if content does not exist', async () => {
      global.mockPrisma.content.findUnique.mockResolvedValue(null);

      const result = await ContentService.getByIdOwned('content-999', 'user-123');

      expect(result).toBeNull();
    });
  });

  describe('updateOwned', () => {
    it('should update content if user owns it', async () => {
      const contentId = 'content-1';
      const userId = 'user-123';
      const mockExisting = { id: contentId, userId, title: 'Old Title', status: 'DRAFT' };
      const updateData = { title: 'New Title' };
      const mockUpdated = { ...mockExisting, ...updateData };

      global.mockPrisma.content.findUnique.mockResolvedValue(mockExisting);
      global.mockPrisma.content.update.mockResolvedValue(mockUpdated);

      const result = await ContentService.updateOwned(contentId, userId, updateData);

      expect(global.mockPrisma.content.update).toHaveBeenCalled();
      expect(result.title).toBe('New Title');
    });
  });
});