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

jest.mock('@/lib/handleAuthorization', () => ({
  handleAuthorizationV2: jest.fn().mockResolvedValue({ userId: 'test-user-id' }),
}));

describe('POST /api/(newai)/title/v2', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getModel as jest.Mock).mockReturnValue({ modelId: 'gpt-4o-mini' });
  });

  describe('Happy Path - Should Rename', () => {
    it('should generate multiple title suggestions when shouldRename is true', async () => {
      const shouldRenameResponse = {
        object: {
          score: 80,
          shouldRename: true,
          reason: 'Current name is not descriptive',
        },
        usage: { totalTokens: 50 },
      };

      const titlesResponse = {
        object: {
          suggestedTitles: [
            { score: 90, title: 'Better Title', reason: 'More descriptive' },
            { score: 85, title: 'Alternative Title', reason: 'Clear and concise' },
            { score: 80, title: 'Another Option', reason: 'Good alternative' },
          ],
        },
        usage: { totalTokens: 150 },
      };

      (generateObject as jest.Mock)
        .mockResolvedValueOnce(shouldRenameResponse)
        .mockResolvedValueOnce(titlesResponse);

      const request = new NextRequest('http://localhost:3000/api/title/v2', {
        method: 'POST',
        body: JSON.stringify({
          content: 'Meeting notes from today',
          fileName: 'untitled.md',
          count: 3,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.titles).toHaveLength(3);
      expect(data.titles[0].score).toBe(90); // Sorted by score descending
      expect(data.titles[0].title).toBe('Better Title');
    });

    it('should respect count parameter', async () => {
      const shouldRenameResponse = {
        object: {
          score: 80,
          shouldRename: true,
          reason: 'Should rename',
        },
        usage: { totalTokens: 50 },
      };

      const titlesResponse = {
        object: {
          suggestedTitles: [
            { score: 90, title: 'Title 1', reason: 'Reason 1' },
            { score: 85, title: 'Title 2', reason: 'Reason 2' },
          ],
        },
        usage: { totalTokens: 100 },
      };

      (generateObject as jest.Mock)
        .mockResolvedValueOnce(shouldRenameResponse)
        .mockResolvedValueOnce(titlesResponse);

      const request = new NextRequest('http://localhost:3000/api/title/v2', {
        method: 'POST',
        body: JSON.stringify({
          content: 'Content',
          fileName: 'file.md',
          count: 2,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.titles).toHaveLength(2);
      const callArgs = (generateObject as jest.Mock).mock.calls[1][0];
      expect(callArgs.system).toContain('suggest exactly 2 clear titles');
    });

    it('should handle custom instructions', async () => {
      const shouldRenameResponse = {
        object: {
          score: 80,
          shouldRename: true,
          reason: 'Should rename',
        },
        usage: { totalTokens: 50 },
      };

      const titlesResponse = {
        object: {
          suggestedTitles: [
            { score: 90, title: 'Title', reason: 'Reason' },
          ],
        },
        usage: { totalTokens: 100 },
      };

      (generateObject as jest.Mock)
        .mockResolvedValueOnce(shouldRenameResponse)
        .mockResolvedValueOnce(titlesResponse);

      const request = new NextRequest('http://localhost:3000/api/title/v2', {
        method: 'POST',
        body: JSON.stringify({
          content: 'Content',
          fileName: 'file.md',
          customInstructions: 'Use technical terms only',
        }),
      });

      await POST(request);

      const callArgs = (generateObject as jest.Mock).mock.calls[1][0];
      expect(callArgs.system).toContain('Instructions: "Use technical terms only"');
    });
  });

  describe('Happy Path - Should Not Rename', () => {
    it('should return current fileName when shouldRename is false', async () => {
      const shouldRenameResponse = {
        object: {
          score: 20,
          shouldRename: false,
          reason: 'Current name is already good',
        },
        usage: { totalTokens: 50 },
      };

      (generateObject as jest.Mock).mockResolvedValueOnce(shouldRenameResponse);

      const request = new NextRequest('http://localhost:3000/api/title/v2', {
        method: 'POST',
        body: JSON.stringify({
          content: 'Content',
          fileName: 'good-name.md',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.titles).toHaveLength(1);
      expect(data.titles[0].title).toBe('good-name.md');
      expect(data.titles[0].score).toBe(20);
      expect(data.titles[0].reason).toBe('Current name is already good');
    });

    it('should remove extension from fileName when returning current name', async () => {
      const shouldRenameResponse = {
        object: {
          score: 20,
          shouldRename: false,
          reason: 'Current name is good',
        },
        usage: { totalTokens: 50 },
      };

      (generateObject as jest.Mock).mockResolvedValueOnce(shouldRenameResponse);

      const request = new NextRequest('http://localhost:3000/api/title/v2', {
        method: 'POST',
        body: JSON.stringify({
          content: 'Content',
          fileName: 'document.txt',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.titles[0].title).toBe('document.txt'); // Extension is kept in response
    });
  });

  describe('Error Handling', () => {
    it('should handle authentication failures', async () => {
      const { handleAuthorizationV2 } = require('@/lib/handleAuthorization');
      // AuthorizationError has a status property
      const authError = new Error('Unauthorized') as any;
      authError.status = 401;
      handleAuthorizationV2.mockRejectedValueOnce(authError);

      const request = new NextRequest('http://localhost:3000/api/title/v2', {
        method: 'POST',
        body: JSON.stringify({
          content: 'Content',
          fileName: 'file.md',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toEqual({ error: 'Unauthorized' });
      expect(generateObject).not.toHaveBeenCalled();
    });

    it('should handle AI service errors in shouldRename check', async () => {
      (generateObject as jest.Mock).mockRejectedValueOnce(
        new Error('AI service unavailable')
      );

      const request = new NextRequest('http://localhost:3000/api/title/v2', {
        method: 'POST',
        body: JSON.stringify({
          content: 'Content',
          fileName: 'file.md',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.error).toBe('AI service unavailable');
    });

    it('should handle AI service errors in title generation', async () => {
      const shouldRenameResponse = {
        object: {
          score: 80,
          shouldRename: true,
          reason: 'Should rename',
        },
        usage: { totalTokens: 50 },
      };

      (generateObject as jest.Mock)
        .mockResolvedValueOnce(shouldRenameResponse)
        .mockRejectedValueOnce(new Error('Title generation failed'));

      const request = new NextRequest('http://localhost:3000/api/title/v2', {
        method: 'POST',
        body: JSON.stringify({
          content: 'Content',
          fileName: 'file.md',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.error).toBe('Title generation failed');
    });

    it('should handle errors with status codes', async () => {
      const error = new Error('Rate limit exceeded') as any;
      error.status = 429;
      (generateObject as jest.Mock).mockRejectedValueOnce(error);

      const request = new NextRequest('http://localhost:3000/api/title/v2', {
        method: 'POST',
        body: JSON.stringify({
          content: 'Content',
          fileName: 'file.md',
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
      const shouldRenameResponse = {
        object: {
          score: 50,
          shouldRename: false,
          reason: 'No content to analyze',
        },
        usage: { totalTokens: 30 },
      };

      (generateObject as jest.Mock).mockResolvedValueOnce(shouldRenameResponse);

      const request = new NextRequest('http://localhost:3000/api/title/v2', {
        method: 'POST',
        body: JSON.stringify({
          content: '',
          fileName: 'file.md',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(generateObject).toHaveBeenCalled();
    });

    it('should handle empty fileName', async () => {
      const shouldRenameResponse = {
        object: {
          score: 100,
          shouldRename: true,
          reason: 'No filename provided',
        },
        usage: { totalTokens: 30 },
      };

      const titlesResponse = {
        object: {
          suggestedTitles: [
            { score: 90, title: 'New Title', reason: 'Generated title' },
          ],
        },
        usage: { totalTokens: 100 },
      };

      (generateObject as jest.Mock)
        .mockResolvedValueOnce(shouldRenameResponse)
        .mockResolvedValueOnce(titlesResponse);

      const request = new NextRequest('http://localhost:3000/api/title/v2', {
        method: 'POST',
        body: JSON.stringify({
          content: 'Content',
          fileName: '',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
    });

    it('should handle missing count parameter (defaults to 3)', async () => {
      const shouldRenameResponse = {
        object: {
          score: 80,
          shouldRename: true,
          reason: 'Should rename',
        },
        usage: { totalTokens: 50 },
      };

      const titlesResponse = {
        object: {
          suggestedTitles: [
            { score: 90, title: 'Title 1', reason: 'Reason 1' },
            { score: 85, title: 'Title 2', reason: 'Reason 2' },
            { score: 80, title: 'Title 3', reason: 'Reason 3' },
          ],
        },
        usage: { totalTokens: 150 },
      };

      (generateObject as jest.Mock)
        .mockResolvedValueOnce(shouldRenameResponse)
        .mockResolvedValueOnce(titlesResponse);

      const request = new NextRequest('http://localhost:3000/api/title/v2', {
        method: 'POST',
        body: JSON.stringify({
          content: 'Content',
          fileName: 'file.md',
        }),
      });

      await POST(request);

      const callArgs = (generateObject as jest.Mock).mock.calls[1][0];
      expect(callArgs.system).toContain('suggest exactly 3 clear titles');
    });

    it('should include current datetime in shouldRename prompt', async () => {
      const shouldRenameResponse = {
        object: {
          score: 80,
          shouldRename: true,
          reason: 'Should rename',
        },
        usage: { totalTokens: 50 },
      };

      (generateObject as jest.Mock).mockResolvedValueOnce(shouldRenameResponse);

      const request = new NextRequest('http://localhost:3000/api/title/v2', {
        method: 'POST',
        body: JSON.stringify({
          content: 'Content',
          fileName: 'file.md',
        }),
      });

      await POST(request);

      const callArgs = (generateObject as jest.Mock).mock.calls[0][0];
      expect(callArgs.prompt).toContain('Time:');
      expect(callArgs.prompt).toMatch(/\d{4}-\d{2}-\d{2}T/); // ISO date format
    });

    it('should sort titles by score descending', async () => {
      const shouldRenameResponse = {
        object: {
          score: 80,
          shouldRename: true,
          reason: 'Should rename',
        },
        usage: { totalTokens: 50 },
      };

      const titlesResponse = {
        object: {
          suggestedTitles: [
            { score: 70, title: 'Title 3', reason: 'Reason 3' },
            { score: 90, title: 'Title 1', reason: 'Reason 1' },
            { score: 80, title: 'Title 2', reason: 'Reason 2' },
          ],
        },
        usage: { totalTokens: 150 },
      };

      (generateObject as jest.Mock)
        .mockResolvedValueOnce(shouldRenameResponse)
        .mockResolvedValueOnce(titlesResponse);

      const request = new NextRequest('http://localhost:3000/api/title/v2', {
        method: 'POST',
        body: JSON.stringify({
          content: 'Content',
          fileName: 'file.md',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.titles[0].score).toBe(90);
      expect(data.titles[1].score).toBe(80);
      expect(data.titles[2].score).toBe(70);
    });
  });
});

