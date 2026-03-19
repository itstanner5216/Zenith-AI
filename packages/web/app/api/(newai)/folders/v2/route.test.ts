import { NextRequest } from 'next/server';
import { POST } from './route';
import { generateObject } from 'ai';
import { getModel } from '@/lib/models';

// Mock dependencies
jest.mock('ai', () => ({
  generateObject: jest.fn(),
}));

jest.mock('@/lib/models', () => ({
  getModel: jest.fn(),
}));

jest.mock('@/lib/handleAuthorization', () => {
  // Must call requireActual inside the factory function
  const actual = jest.requireActual<typeof import('@/lib/handleAuthorization')>('@/lib/handleAuthorization');
  return {
    __esModule: true,
    // Export the real AuthorizationError class so instanceof checks work
    AuthorizationError: actual.AuthorizationError,
    handleAuthorizationV2: jest.fn().mockResolvedValue({ userId: 'test-user-id' }),
    getToken: actual.getToken,
  };
});

describe('POST /api/(newai)/folders/v2', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getModel as jest.Mock).mockReturnValue({ modelId: 'gpt-4o-mini' });
  });

  describe('Happy Path', () => {
    it('should generate folder suggestions and return sorted by score', async () => {
      const mockResponse = {
        object: {
          suggestedFolders: [
            { score: 90, isNewFolder: false, folder: 'meetings', reason: 'Content is about meetings' },
            { score: 75, isNewFolder: true, folder: 'planning', reason: 'New folder for planning' },
            { score: 60, isNewFolder: false, folder: 'notes', reason: 'General notes folder' },
          ],
        },
        usage: { totalTokens: 200 },
      };
      (generateObject as jest.Mock).mockResolvedValueOnce(mockResponse);

      const request = new NextRequest('http://localhost:3000/api/folders/v2', {
        method: 'POST',
        body: JSON.stringify({
          content: 'Meeting notes from today',
          fileName: 'meeting.md',
          folders: ['meetings', 'notes', 'projects'],
          count: 3,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.folders).toHaveLength(3);
      expect(data.folders[0].score).toBe(90); // Sorted by score descending
      expect(data.folders[0].folder).toBe('meetings');
      expect(data.folders[1].folder).toBe('planning');
      expect(data.folders[2].folder).toBe('notes');
    });

    it('should handle custom instructions', async () => {
      const mockResponse = {
        object: {
          suggestedFolders: [
            { score: 85, isNewFolder: true, folder: 'custom', reason: 'Custom folder' },
          ],
        },
        usage: { totalTokens: 100 },
      };
      (generateObject as jest.Mock).mockResolvedValueOnce(mockResponse);

      const request = new NextRequest('http://localhost:3000/api/folders/v2', {
        method: 'POST',
        body: JSON.stringify({
          content: 'Content',
          fileName: 'file.md',
          folders: ['folder1', 'folder2'],
          customInstructions: 'Use technical folder names only',
          count: 1,
        }),
      });

      await POST(request);

      const callArgs = (generateObject as jest.Mock).mock.calls[0][0];
      expect(callArgs.system).toContain('Instructions: "Use technical folder names only"');
    });

    it('should include folders in system prompt', async () => {
      const mockResponse = {
        object: {
          suggestedFolders: [
            { score: 80, isNewFolder: false, folder: 'folder1', reason: 'Reason' },
          ],
        },
        usage: { totalTokens: 100 },
      };
      (generateObject as jest.Mock).mockResolvedValueOnce(mockResponse);

      const request = new NextRequest('http://localhost:3000/api/folders/v2', {
        method: 'POST',
        body: JSON.stringify({
          content: 'Content',
          fileName: 'file.md',
          folders: ['folder1', 'folder2', 'folder3'],
          count: 1,
        }),
      });

      await POST(request);

      const callArgs = (generateObject as jest.Mock).mock.calls[0][0];
      expect(callArgs.system).toContain('folder1, folder2, folder3');
    });
  });

  describe('Error Handling', () => {
    it('should handle authentication failures', async () => {
      const { handleAuthorizationV2 } = require('@/lib/handleAuthorization');
      const authError = new Error('Unauthorized') as any;
      authError.status = 401;
      handleAuthorizationV2.mockRejectedValueOnce(authError);

      const request = new NextRequest('http://localhost:3000/api/folders/v2', {
        method: 'POST',
        body: JSON.stringify({
          content: 'Content',
          fileName: 'file.md',
          folders: ['folder1'],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toEqual({ error: 'Unauthorized' });
      expect(generateObject).not.toHaveBeenCalled();
    });

    it('should handle AI service errors', async () => {
      (generateObject as jest.Mock).mockRejectedValueOnce(
        new Error('AI service unavailable')
      );

      const request = new NextRequest('http://localhost:3000/api/folders/v2', {
        method: 'POST',
        body: JSON.stringify({
          content: 'Content',
          fileName: 'file.md',
          folders: ['folder1'],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.error).toBe('AI service unavailable');
    });

    it('should handle errors with status codes', async () => {
      const error = new Error('Rate limit exceeded') as any;
      error.status = 429;
      (generateObject as jest.Mock).mockRejectedValueOnce(error);

      const request = new NextRequest('http://localhost:3000/api/folders/v2', {
        method: 'POST',
        body: JSON.stringify({
          content: 'Content',
          fileName: 'file.md',
          folders: ['folder1'],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.error).toBe('Rate limit exceeded');
    });

  });

  describe('Edge Cases', () => {
    it('should handle empty content', async () => {
      const mockResponse = {
        object: {
          suggestedFolders: [
            { score: 50, isNewFolder: true, folder: 'untitled', reason: 'No content' },
          ],
        },
        usage: { totalTokens: 50 },
      };
      (generateObject as jest.Mock).mockResolvedValueOnce(mockResponse);

      const request = new NextRequest('http://localhost:3000/api/folders/v2', {
        method: 'POST',
        body: JSON.stringify({
          content: '',
          fileName: 'file.md',
          folders: ['folder1'],
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(generateObject).toHaveBeenCalled();
    });

    it('should handle empty folders array', async () => {
      const mockResponse = {
        object: {
          suggestedFolders: [
            { score: 80, isNewFolder: true, folder: 'new', reason: 'New folder' },
          ],
        },
        usage: { totalTokens: 100 },
      };
      (generateObject as jest.Mock).mockResolvedValueOnce(mockResponse);

      const request = new NextRequest('http://localhost:3000/api/folders/v2', {
        method: 'POST',
        body: JSON.stringify({
          content: 'Content',
          fileName: 'file.md',
          folders: [],
        }),
      });

      await POST(request);

      const callArgs = (generateObject as jest.Mock).mock.calls[0][0];
      expect(callArgs.system).toContain('You can use: . If none are relevant');
    });

    it('should handle custom count parameter', async () => {
      const mockResponse = {
        object: {
          suggestedFolders: [
            { score: 80, isNewFolder: true, folder: 'folder1', reason: 'Reason 1' },
            { score: 70, isNewFolder: true, folder: 'folder2', reason: 'Reason 2' },
            { score: 60, isNewFolder: true, folder: 'folder3', reason: 'Reason 3' },
            { score: 50, isNewFolder: true, folder: 'folder4', reason: 'Reason 4' },
            { score: 40, isNewFolder: true, folder: 'folder5', reason: 'Reason 5' },
          ],
        },
        usage: { totalTokens: 200 },
      };
      (generateObject as jest.Mock).mockResolvedValueOnce(mockResponse);

      const request = new NextRequest('http://localhost:3000/api/folders/v2', {
        method: 'POST',
        body: JSON.stringify({
          content: 'Content',
          fileName: 'file.md',
          folders: ['folder1'],
          count: 5,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.folders).toHaveLength(5);
      const callArgs = (generateObject as jest.Mock).mock.calls[0][0];
      expect(callArgs.system).toContain('suggest exactly 5 folders');
    });

    it('should handle missing count parameter (defaults to 3)', async () => {
      const mockResponse = {
        object: {
          suggestedFolders: [
            { score: 80, isNewFolder: true, folder: 'folder', reason: 'Reason' },
          ],
        },
        usage: { totalTokens: 100 },
      };
      (generateObject as jest.Mock).mockResolvedValueOnce(mockResponse);

      const request = new NextRequest('http://localhost:3000/api/folders/v2', {
        method: 'POST',
        body: JSON.stringify({
          content: 'Content',
          fileName: 'file.md',
          folders: ['folder1'],
        }),
      });

      await POST(request);

      const callArgs = (generateObject as jest.Mock).mock.calls[0][0];
      expect(callArgs.system).toContain('suggest exactly 3 folders');
    });

    it('should handle empty customInstructions', async () => {
      const mockResponse = {
        object: {
          suggestedFolders: [
            { score: 80, isNewFolder: true, folder: 'folder', reason: 'Reason' },
          ],
        },
        usage: { totalTokens: 100 },
      };
      (generateObject as jest.Mock).mockResolvedValueOnce(mockResponse);

      const request = new NextRequest('http://localhost:3000/api/folders/v2', {
        method: 'POST',
        body: JSON.stringify({
          content: 'Content',
          fileName: 'file.md',
          folders: ['folder1'],
          customInstructions: '',
        }),
      });

      await POST(request);

      const callArgs = (generateObject as jest.Mock).mock.calls[0][0];
      expect(callArgs.system).not.toContain('Instructions:');
    });

    it('should sort folders by score descending', async () => {
      const mockResponse = {
        object: {
          suggestedFolders: [
            { score: 50, isNewFolder: true, folder: 'low', reason: 'Low score' },
            { score: 90, isNewFolder: true, folder: 'high', reason: 'High score' },
            { score: 70, isNewFolder: true, folder: 'medium', reason: 'Medium score' },
          ],
        },
        usage: { totalTokens: 150 },
      };
      (generateObject as jest.Mock).mockResolvedValueOnce(mockResponse);

      const request = new NextRequest('http://localhost:3000/api/folders/v2', {
        method: 'POST',
        body: JSON.stringify({
          content: 'Content',
          fileName: 'file.md',
          folders: ['folder1'],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.folders[0].score).toBe(90);
      expect(data.folders[1].score).toBe(70);
      expect(data.folders[2].score).toBe(50);
    });
  });
});

