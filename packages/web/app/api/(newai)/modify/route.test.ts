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

describe('POST /api/(newai)/modify', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getModel as jest.Mock).mockReturnValue({ modelId: 'gpt-4o-mini' });
  });

  describe('Happy Path', () => {
    it('should modify content and return modified content with diff', async () => {
      const originalContent = 'Original content line 1\nOriginal content line 2';
      const modifiedContent = 'Modified content line 1\nModified content line 2\nNew line';

      const mockResponse = {
        object: {
          content: modifiedContent,
          diff: [
            { value: 'Modified content line 1\n', added: true },
            { value: 'Original content line 1\n', removed: true },
            { value: 'Modified content line 2\n', added: true },
            { value: 'Original content line 2', removed: true },
            { value: 'New line', added: true },
          ],
          explanation: 'Updated content with new information and added a new line',
        },
        usage: { totalTokens: 200 },
      };
      (generateObject as jest.Mock).mockResolvedValueOnce(mockResponse);

      const request = new NextRequest('http://localhost:3000/api/modify', {
        method: 'POST',
        body: JSON.stringify({
          content: 'Some modification instruction',
          originalContent,
          instructions: 'Update the content with new information',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.content).toBe(modifiedContent);
      expect(data.diff).toBeDefined();
      expect(data.explanation).toBe('Updated content with new information and added a new line');
    });

    it('should generate diff from original and modified content', async () => {
      const originalContent = 'Line 1\nLine 2';
      const modifiedContent = 'Line 1\nLine 2 Modified\nLine 3';

      const mockResponse = {
        object: {
          content: modifiedContent,
          diff: [],
          explanation: 'Modified content',
        },
        usage: { totalTokens: 150 },
      };
      (generateObject as jest.Mock).mockResolvedValueOnce(mockResponse);

      const request = new NextRequest('http://localhost:3000/api/modify', {
        method: 'POST',
        body: JSON.stringify({
          content: 'Modify instruction',
          originalContent,
          instructions: 'Add a new line',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      // Diff should be generated from actual content difference
      expect(data.diff).toBeDefined();
      expect(Array.isArray(data.diff)).toBe(true);
    });

    it('should include instructions in prompt', async () => {
      const mockResponse = {
        object: {
          content: 'Modified',
          diff: [],
          explanation: 'Modified',
        },
        usage: { totalTokens: 100 },
      };
      (generateObject as jest.Mock).mockResolvedValueOnce(mockResponse);

      const request = new NextRequest('http://localhost:3000/api/modify', {
        method: 'POST',
        body: JSON.stringify({
          content: 'Content to apply',
          originalContent: 'Original',
          instructions: 'Make it more concise',
        }),
      });

      await POST(request);

      const callArgs = (generateObject as jest.Mock).mock.calls[0][0];
      expect(callArgs.prompt).toContain('Make it more concise');
      expect(callArgs.prompt).toContain('Original');
      expect(callArgs.prompt).toContain('Content to apply');
    });
  });

  describe('Error Handling', () => {
    it('should handle authentication failures', async () => {
      const { handleAuthorizationV2 } = require('@/lib/handleAuthorization');
      const authError = new Error('Unauthorized') as any;
      authError.status = 401;
      handleAuthorizationV2.mockRejectedValueOnce(authError);

      const request = new NextRequest('http://localhost:3000/api/modify', {
        method: 'POST',
        body: JSON.stringify({
          content: 'Content',
          originalContent: 'Original',
          instructions: 'Modify',
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

      const request = new NextRequest('http://localhost:3000/api/modify', {
        method: 'POST',
        body: JSON.stringify({
          content: 'Content',
          originalContent: 'Original',
          instructions: 'Modify',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('AI service unavailable');
    });

    it('should handle errors with status codes', async () => {
      const error = new Error('Rate limit exceeded') as any;
      error.status = 429;
      (generateObject as jest.Mock).mockRejectedValueOnce(error);

      const request = new NextRequest('http://localhost:3000/api/modify', {
        method: 'POST',
        body: JSON.stringify({
          content: 'Content',
          originalContent: 'Original',
          instructions: 'Modify',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.error).toBe('Rate limit exceeded');
    });

  });

  describe('Edge Cases', () => {
    it('should handle empty original content', async () => {
      const mockResponse = {
        object: {
          content: 'New content',
          diff: [],
          explanation: 'Added new content',
        },
        usage: { totalTokens: 50 },
      };
      (generateObject as jest.Mock).mockResolvedValueOnce(mockResponse);

      const request = new NextRequest('http://localhost:3000/api/modify', {
        method: 'POST',
        body: JSON.stringify({
          content: 'Content',
          originalContent: '',
          instructions: 'Add content',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(generateObject).toHaveBeenCalled();
    });

    it('should handle empty modified content', async () => {
      const mockResponse = {
        object: {
          content: '',
          diff: [],
          explanation: 'Removed all content',
        },
        usage: { totalTokens: 50 },
      };
      (generateObject as jest.Mock).mockResolvedValueOnce(mockResponse);

      const request = new NextRequest('http://localhost:3000/api/modify', {
        method: 'POST',
        body: JSON.stringify({
          content: 'Content',
          originalContent: 'Original content',
          instructions: 'Remove all content',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(response.json().then((d: any) => d.content)).resolves.toBe('');
    });

    it('should handle empty instructions', async () => {
      const mockResponse = {
        object: {
          content: 'Modified',
          diff: [],
          explanation: 'Modified',
        },
        usage: { totalTokens: 100 },
      };
      (generateObject as jest.Mock).mockResolvedValueOnce(mockResponse);

      const request = new NextRequest('http://localhost:3000/api/modify', {
        method: 'POST',
        body: JSON.stringify({
          content: 'Content',
          originalContent: 'Original',
          instructions: '',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
    });

    it('should handle large content', async () => {
      const largeContent = 'x'.repeat(100000);
      const mockResponse = {
        object: {
          content: largeContent + ' modified',
          diff: [],
          explanation: 'Modified large content',
        },
        usage: { totalTokens: 5000 },
      };
      (generateObject as jest.Mock).mockResolvedValueOnce(mockResponse);

      const request = new NextRequest('http://localhost:3000/api/modify', {
        method: 'POST',
        body: JSON.stringify({
          content: 'Modify',
          originalContent: largeContent,
          instructions: 'Modify',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(generateObject).toHaveBeenCalled();
    });

    it('should handle identical original and modified content', async () => {
      const content = 'Same content';
      const mockResponse = {
        object: {
          content,
          diff: [],
          explanation: 'No changes needed',
        },
        usage: { totalTokens: 50 },
      };
      (generateObject as jest.Mock).mockResolvedValueOnce(mockResponse);

      const request = new NextRequest('http://localhost:3000/api/modify', {
        method: 'POST',
        body: JSON.stringify({
          content: 'Same content',
          originalContent: content,
          instructions: 'Keep the same',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.content).toBe(content);
      // Diff should be empty or show no changes
      expect(data.diff).toBeDefined();
    });

    it('should handle missing request body', async () => {
      const request = new NextRequest('http://localhost:3000/api/modify', {
        method: 'POST',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toHaveProperty('error');
    });

    it('should handle invalid JSON in request body', async () => {
      const request = new NextRequest('http://localhost:3000/api/modify', {
        method: 'POST',
        body: 'invalid json',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toHaveProperty('error');
    });

    it('should generate proper diff structure', async () => {
      const originalContent = 'Line 1\nLine 2';
      const modifiedContent = 'Line 1\nLine 2 Modified';

      const mockResponse = {
        object: {
          content: modifiedContent,
          diff: [],
          explanation: 'Modified',
        },
        usage: { totalTokens: 100 },
      };
      (generateObject as jest.Mock).mockResolvedValueOnce(mockResponse);

      const request = new NextRequest('http://localhost:3000/api/modify', {
        method: 'POST',
        body: JSON.stringify({
          content: 'Modify',
          originalContent,
          instructions: 'Modify line 2',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      // Diff should be an array with diff objects
      expect(Array.isArray(data.diff)).toBe(true);
      // Each diff item should have value and optional added/removed flags
      if (data.diff.length > 0) {
        expect(data.diff[0]).toHaveProperty('value');
      }
    });
  });
});

