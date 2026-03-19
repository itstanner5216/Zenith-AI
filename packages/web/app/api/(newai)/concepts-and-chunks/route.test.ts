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

describe('POST /api/(newai)/concepts-and-chunks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getModel as jest.Mock).mockReturnValue({ modelId: 'gpt-4o-mini' });
  });

  describe('Happy Path', () => {
    it('should identify concepts and return chunks', async () => {
      const mockResponse = {
        object: {
          concepts: [
            {
              name: 'Machine Learning',
              chunk: 'Machine learning is a subset of artificial intelligence...',
            },
            {
              name: 'Neural Networks',
              chunk: 'Neural networks are computing systems inspired by biological neural networks...',
            },
            {
              name: 'Deep Learning',
              chunk: 'Deep learning uses neural networks with multiple layers...',
            },
          ],
        },
        usage: { totalTokens: 300 },
      };
      (generateObject as jest.Mock).mockResolvedValueOnce(mockResponse);

      const request = new NextRequest(
        'http://localhost:3000/api/concepts-and-chunks',
        {
          method: 'POST',
          body: JSON.stringify({
            content: 'Document about machine learning and neural networks...',
          }),
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.concepts).toHaveLength(3);
      expect(data.concepts[0].name).toBe('Machine Learning');
      expect(data.concepts[0].chunk).toBeDefined();
    });

    it('should preserve markdown formatting in chunks', async () => {
      const mockResponse = {
        object: {
          concepts: [
            {
              name: 'Code Example',
              chunk: '```python\ndef hello():\n    print("Hello")\n```',
            },
          ],
        },
        usage: { totalTokens: 100 },
      };
      (generateObject as jest.Mock).mockResolvedValueOnce(mockResponse);

      const request = new NextRequest(
        'http://localhost:3000/api/concepts-and-chunks',
        {
          method: 'POST',
          body: JSON.stringify({
            content: 'Code example with markdown...',
          }),
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.concepts[0].chunk).toContain('```python');
    });
  });

  describe('Error Handling', () => {
    it('should handle authentication failures', async () => {
      const { handleAuthorizationV2 } = require('@/lib/handleAuthorization');
      const authError = new Error('Unauthorized') as any;
      authError.status = 401;
      handleAuthorizationV2.mockRejectedValueOnce(authError);

      const request = new NextRequest(
        'http://localhost:3000/api/concepts-and-chunks',
        {
          method: 'POST',
          body: JSON.stringify({
            content: 'Content',
          }),
        }
      );

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

      const request = new NextRequest(
        'http://localhost:3000/api/concepts-and-chunks',
        {
          method: 'POST',
          body: JSON.stringify({
            content: 'Content',
          }),
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('AI service unavailable');
    });

    it('should handle errors with status codes', async () => {
      const error = new Error('Rate limit exceeded') as any;
      error.status = 429;
      (generateObject as jest.Mock).mockRejectedValueOnce(error);

      const request = new NextRequest(
        'http://localhost:3000/api/concepts-and-chunks',
        {
          method: 'POST',
          body: JSON.stringify({
            content: 'Content',
          }),
        }
      );

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
          concepts: [],
        },
        usage: { totalTokens: 50 },
      };
      (generateObject as jest.Mock).mockResolvedValueOnce(mockResponse);

      const request = new NextRequest(
        'http://localhost:3000/api/concepts-and-chunks',
        {
          method: 'POST',
          body: JSON.stringify({
            content: '',
          }),
        }
      );

      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(generateObject).toHaveBeenCalled();
    });

    it('should handle empty concepts array', async () => {
      const mockResponse = {
        object: {
          concepts: [],
        },
        usage: { totalTokens: 50 },
      };
      (generateObject as jest.Mock).mockResolvedValueOnce(mockResponse);

      const request = new NextRequest(
        'http://localhost:3000/api/concepts-and-chunks',
        {
          method: 'POST',
          body: JSON.stringify({
            content: 'Minimal content',
          }),
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.concepts).toEqual([]);
    });

    it('should handle large content', async () => {
      const largeContent = 'x'.repeat(100000);
      const mockResponse = {
        object: {
          concepts: [
            { name: 'Concept', chunk: 'Chunk' },
          ],
        },
        usage: { totalTokens: 5000 },
      };
      (generateObject as jest.Mock).mockResolvedValueOnce(mockResponse);

      const request = new NextRequest(
        'http://localhost:3000/api/concepts-and-chunks',
        {
          method: 'POST',
          body: JSON.stringify({
            content: largeContent,
          }),
        }
      );

      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(generateObject).toHaveBeenCalled();
    });

    it('should handle missing request body', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/concepts-and-chunks',
        {
          method: 'POST',
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toHaveProperty('error');
    });

    it('should handle invalid JSON in request body', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/concepts-and-chunks',
        {
          method: 'POST',
          body: 'invalid json',
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toHaveProperty('error');
    });

    it('should handle zero tokens', async () => {
      const mockResponse = {
        object: {
          concepts: [
            { name: 'Concept', chunk: 'Chunk' },
          ],
        },
        usage: { totalTokens: 0 },
      };
      (generateObject as jest.Mock).mockResolvedValueOnce(mockResponse);

      const request = new NextRequest(
        'http://localhost:3000/api/concepts-and-chunks',
        {
          method: 'POST',
          body: JSON.stringify({
            content: 'Content',
          }),
        }
      );

      const response = await POST(request);
      expect(response.status).toBe(200);
    });

    it('should handle missing usage in response', async () => {
      const mockResponse = {
        object: {
          concepts: [
            { name: 'Concept', chunk: 'Chunk' },
          ],
        },
        // No usage field
      };
      (generateObject as jest.Mock).mockResolvedValueOnce(mockResponse);

      const request = new NextRequest(
        'http://localhost:3000/api/concepts-and-chunks',
        {
          method: 'POST',
          body: JSON.stringify({
            content: 'Content',
          }),
        }
      );

      const response = await POST(request);
      expect(response.status).toBe(200);
      // Should default to 0 tokens if usage is missing
    });
  });
});

