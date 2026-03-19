import { NextRequest } from 'next/server';
import { POST } from './route';
import { classifyDocument } from '../aiService';
import { getModel } from '@/lib/models';

// Mock dependencies
jest.mock('../aiService', () => ({
  classifyDocument: jest.fn(),
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

describe('POST /api/(newai)/classify1', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getModel as jest.Mock).mockReturnValue({ modelId: 'gpt-4o-mini' });
  });

  describe('Happy Path', () => {
    it('should classify document and return documentType', async () => {
      const mockResponse = {
        object: { documentType: 'meeting-notes' },
        usage: { totalTokens: 150 },
      };
      (classifyDocument as jest.Mock).mockResolvedValueOnce(mockResponse);

      const request = new NextRequest('http://localhost:3000/api/classify1', {
        method: 'POST',
        body: JSON.stringify({
          content: 'Meeting notes from today',
          fileName: 'meeting.md',
          templateNames: ['meeting-notes', 'todo-list', 'journal'],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ documentType: 'meeting-notes' });
      expect(classifyDocument).toHaveBeenCalledWith(
        'Meeting notes from today',
        'meeting.md',
        ['meeting-notes', 'todo-list', 'journal'],
        { modelId: 'gpt-4o-mini' }
      );
    });

    it('should handle empty documentType when no match found', async () => {
      const mockResponse = {
        object: { documentType: '' },
        usage: { totalTokens: 100 },
      };
      (classifyDocument as jest.Mock).mockResolvedValueOnce(mockResponse);

      const request = new NextRequest('http://localhost:3000/api/classify1', {
        method: 'POST',
        body: JSON.stringify({
          content: 'Random content',
          fileName: 'file.md',
          templateNames: ['meeting-notes', 'todo-list'],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ documentType: '' });
    });

    it('should handle optional documentType', async () => {
      const mockResponse = {
        object: {},
        usage: { totalTokens: 100 },
      };
      (classifyDocument as jest.Mock).mockResolvedValueOnce(mockResponse);

      const request = new NextRequest('http://localhost:3000/api/classify1', {
        method: 'POST',
        body: JSON.stringify({
          content: 'Content',
          fileName: 'file.md',
          templateNames: ['template1'],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ documentType: undefined });
    });
  });

  describe('Error Handling', () => {
    it('should handle authentication failures', async () => {
      const { handleAuthorizationV2 } = require('@/lib/handleAuthorization');
      const authError = new Error('Unauthorized') as any;
      authError.status = 401;
      handleAuthorizationV2.mockRejectedValueOnce(authError);

      const request = new NextRequest('http://localhost:3000/api/classify1', {
        method: 'POST',
        body: JSON.stringify({
          content: 'Content',
          fileName: 'file.md',
          templateNames: ['template1'],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toEqual({ error: 'Unauthorized' });
      expect(classifyDocument).not.toHaveBeenCalled();
    });

    it('should handle AI service errors', async () => {
      (classifyDocument as jest.Mock).mockRejectedValueOnce(
        new Error('AI service unavailable')
      );

      const request = new NextRequest('http://localhost:3000/api/classify1', {
        method: 'POST',
        body: JSON.stringify({
          content: 'Content',
          fileName: 'file.md',
          templateNames: ['template1'],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      // classify1 route returns status 500 when error.status is undefined
      expect(response.status).toBe(500);
      expect(data.error).toBe('AI service unavailable');
    });

    it('should handle errors with status codes', async () => {
      const error = new Error('Rate limit exceeded') as any;
      error.status = 429;
      (classifyDocument as jest.Mock).mockRejectedValueOnce(error);

      const request = new NextRequest('http://localhost:3000/api/classify1', {
        method: 'POST',
        body: JSON.stringify({
          content: 'Content',
          fileName: 'file.md',
          templateNames: ['template1'],
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
        object: { documentType: '' },
        usage: { totalTokens: 50 },
      };
      (classifyDocument as jest.Mock).mockResolvedValueOnce(mockResponse);

      const request = new NextRequest('http://localhost:3000/api/classify1', {
        method: 'POST',
        body: JSON.stringify({
          content: '',
          fileName: 'file.md',
          templateNames: ['template1'],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(classifyDocument).toHaveBeenCalledWith(
        '',
        'file.md',
        ['template1'],
        expect.any(Object)
      );
    });

    it('should handle empty fileName', async () => {
      const mockResponse = {
        object: { documentType: 'meeting-notes' },
        usage: { totalTokens: 100 },
      };
      (classifyDocument as jest.Mock).mockResolvedValueOnce(mockResponse);

      const request = new NextRequest('http://localhost:3000/api/classify1', {
        method: 'POST',
        body: JSON.stringify({
          content: 'Content',
          fileName: '',
          templateNames: ['template1'],
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(classifyDocument).toHaveBeenCalledWith(
        'Content',
        '',
        ['template1'],
        expect.any(Object)
      );
    });

    it('should handle empty templateNames array', async () => {
      const mockResponse = {
        object: { documentType: '' },
        usage: { totalTokens: 50 },
      };
      (classifyDocument as jest.Mock).mockResolvedValueOnce(mockResponse);

      const request = new NextRequest('http://localhost:3000/api/classify1', {
        method: 'POST',
        body: JSON.stringify({
          content: 'Content',
          fileName: 'file.md',
          templateNames: [],
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(classifyDocument).toHaveBeenCalledWith(
        'Content',
        'file.md',
        [],
        expect.any(Object)
      );
    });

    it('should handle large content', async () => {
      const largeContent = 'x'.repeat(100000);
      const mockResponse = {
        object: { documentType: 'meeting-notes' },
        usage: { totalTokens: 5000 },
      };
      (classifyDocument as jest.Mock).mockResolvedValueOnce(mockResponse);

      const request = new NextRequest('http://localhost:3000/api/classify1', {
        method: 'POST',
        body: JSON.stringify({
          content: largeContent,
          fileName: 'file.md',
          templateNames: ['template1'],
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(classifyDocument).toHaveBeenCalledWith(
        largeContent,
        'file.md',
        ['template1'],
        expect.any(Object)
      );
    });

    it('should handle missing request body gracefully', async () => {
      const request = new NextRequest('http://localhost:3000/api/classify1', {
        method: 'POST',
      });

      const response = await POST(request);
      const data = await response.json();

      // classify1 route returns status 500 when error.status is undefined (JSON parsing errors don't have status)
      expect(response.status).toBe(500);
      expect(data).toHaveProperty('error');
    });

    it('should handle invalid JSON in request body', async () => {
      const request = new NextRequest('http://localhost:3000/api/classify1', {
        method: 'POST',
        body: 'invalid json',
      });

      const response = await POST(request);
      const data = await response.json();

      // classify1 route returns status 500 when error.status is undefined (JSON parsing errors don't have status)
      expect(response.status).toBe(500);
      expect(data).toHaveProperty('error');
    });

    it('should handle zero tokens', async () => {
      const mockResponse = {
        object: { documentType: 'meeting-notes' },
        usage: { totalTokens: 0 },
      };
      (classifyDocument as jest.Mock).mockResolvedValueOnce(mockResponse);

      const request = new NextRequest('http://localhost:3000/api/classify1', {
        method: 'POST',
        body: JSON.stringify({
          content: 'Content',
          fileName: 'file.md',
          templateNames: ['template1'],
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
    });
  });
});

