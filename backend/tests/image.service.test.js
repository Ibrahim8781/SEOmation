import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// mock FastAPIService before importing ImageService
jest.unstable_mockModule('../src/services/fastapi.service.js', () => ({
  default: { generateImages: jest.fn() }
}));

const FastAPIService = (await import('../src/services/fastapi.service.js')).default;
const { ImageService } = await import('../src/services/image.service.js');

describe('ImageService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.mockPrisma.content = { findUnique: jest.fn(), update: jest.fn() };
    global.mockPrisma.imageAsset = { create: jest.fn() };
    global.mockPrisma.contentImageLink = { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), delete: jest.fn() };
  });

  describe('listForContent', () => {
    it('returns images for owned content', async () => {
      const contentId = 'c1';
      const userId = 'u1';
      const mockContent = { id: contentId, userId, title: 'T' };
      const mockLinks = [{ id: 'l1', contentId, image: { id: 'i1', url: 'u1' } }];

      global.mockPrisma.content.findUnique.mockResolvedValue(mockContent);
      global.mockPrisma.contentImageLink.findMany.mockResolvedValue(mockLinks);

      const res = await ImageService.listForContent(contentId, userId);

      expect(global.mockPrisma.contentImageLink.findMany).toHaveBeenCalledWith({
        where: { contentId },
        include: { image: true },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }]
      });
      expect(res).toEqual(mockLinks);
    });

    it('throws when content not owned or missing', async () => {
      global.mockPrisma.content.findUnique.mockResolvedValue(null);
      await expect(ImageService.listForContent('c1', 'u1')).rejects.toThrow(/Content not found/);

      global.mockPrisma.content.findUnique.mockResolvedValue({ id: 'c1', userId: 'other' });
      await expect(ImageService.listForContent('c1', 'u1')).rejects.toThrow(/Content not found/);
    });
  });

  describe('uploadAndAttach', () => {
    it('uploads and attaches image', async () => {
      const contentId = 'c1';
      const userId = 'u1';
      const payload = { dataUrl: 'data:...,abc', altText: 'alt', role: 'inline', position: 0 };
      const mockContent = { id: contentId, userId, title: 'T' };
      const mockAsset = { id: 'i1', url: payload.dataUrl, altText: payload.altText };
      const mockLink = { id: 'l1', contentId, imageId: mockAsset.id };

      global.mockPrisma.content.findUnique.mockResolvedValue(mockContent);
      global.mockPrisma.imageAsset.create.mockResolvedValue(mockAsset);
      global.mockPrisma.contentImageLink.create.mockResolvedValue(mockLink);
      global.mockPrisma.content.update.mockResolvedValue(mockContent);

      const res = await ImageService.uploadAndAttach(contentId, userId, payload);

      expect(global.mockPrisma.imageAsset.create).toHaveBeenCalled();
      expect(global.mockPrisma.contentImageLink.create).toHaveBeenCalled();
      expect(res.asset).toEqual(mockAsset);
      expect(res.link).toEqual(mockLink);
    });

    it('requires dataUrl or url', async () => {
      global.mockPrisma.content.findUnique.mockResolvedValue({ id: 'c1', userId: 'u1', title: 'T' });
      await expect(ImageService.uploadAndAttach('c1', 'u1', {})).rejects.toThrow(/dataUrl is required/);
    });
  });

  describe('generateAndAttach', () => {
    it('generates images via AI and attaches', async () => {
      const contentId = 'c1';
      const userId = 'u1';
      const payload = { prompt: 'p', style: 's', count: 1 };
      const mockContent = { id: contentId, userId, title: 'T' };
      const aiResp = { altText: 'alt', images: [{ url: 'https://ai/img.jpg', size: '1024x1024', provider: 'ai' }] };
      const mockAsset = { id: 'i1', url: aiResp.images[0].url, altText: aiResp.altText };
      const mockLink = { id: 'l1', contentId, imageId: 'i1' };

      global.mockPrisma.content.findUnique.mockResolvedValue(mockContent);
      FastAPIService.generateImages.mockResolvedValue(aiResp);
      global.mockPrisma.imageAsset.create.mockResolvedValue(mockAsset);
      global.mockPrisma.contentImageLink.create.mockResolvedValue(mockLink);
      global.mockPrisma.content.update.mockResolvedValue(mockContent);

      const res = await ImageService.generateAndAttach(contentId, userId, payload);

      expect(FastAPIService.generateImages).toHaveBeenCalledWith(payload.prompt, expect.objectContaining({ style: payload.style, count: payload.count }));
      expect(res.results).toHaveLength(1);
      expect(res.content).toEqual(mockContent);
    });

    it('requires prompt', async () => {
      global.mockPrisma.content.findUnique.mockResolvedValue({ id: 'c1', userId: 'u1', title: 'T' });
      await expect(ImageService.generateAndAttach('c1', 'u1', {})).rejects.toThrow(/prompt is required/);
    });

    it('handles AI errors with fallback mock image', async () => {
      const contentId = 'c1';
      const userId = 'u1';
      const payload = { prompt: 'p' };
      const mockContent = { id: contentId, userId, title: 'T' };

      global.mockPrisma.content.findUnique.mockResolvedValue(mockContent);
      FastAPIService.generateImages.mockRejectedValue(new Error('ai down'));
      global.mockPrisma.imageAsset.create.mockResolvedValue({ id: 'i1', url: 'data:image/png;base64,mock', provider: 'mock' });
      global.mockPrisma.contentImageLink.create.mockResolvedValue({ id: 'l1', contentId, imageId: 'i1' });
      global.mockPrisma.content.update.mockResolvedValue(mockContent);

      const res = await ImageService.generateAndAttach(contentId, userId, payload);

      expect(res.results.length).toBeGreaterThanOrEqual(1);
      expect(res.results[0].asset.provider).toBe('mock');
    });
  });

  describe('removeLink', () => {
    it('removes link when owned', async () => {
      const contentId = 'c1';
      const linkId = 'l1';
      const userId = 'u1';
      const mockContent = { id: contentId, userId, title: 'T' };
      const mockLink = { id: linkId, contentId, image: { id: 'i1', url: 'u' } };

      global.mockPrisma.content.findUnique.mockResolvedValue(mockContent);
      global.mockPrisma.contentImageLink.findFirst.mockResolvedValue(mockLink);
      global.mockPrisma.contentImageLink.delete.mockResolvedValue(mockLink);

      const res = await ImageService.removeLink(contentId, linkId, userId);

      expect(global.mockPrisma.contentImageLink.delete).toHaveBeenCalledWith({ where: { id: linkId } });
      expect(res).toEqual(mockLink);
    });

    it('throws when link not found', async () => {
      global.mockPrisma.content.findUnique.mockResolvedValue({ id: 'c1', userId: 'u1', title: 'T' });
      global.mockPrisma.contentImageLink.findFirst.mockResolvedValue(null);

      await expect(ImageService.removeLink('c1', 'nope', 'u1')).rejects.toThrow(/Image link not found/);
    });
  });
});