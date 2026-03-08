import { NextRequest } from 'next/server';
import { POST } from './route';
import { generateText } from 'ai';
import { incrementAndLogTokenUsage } from '@/lib/incrementAndLogTokenUsage';
import { getVisionModel } from '@/lib/models';

// Mock dependencies
jest.mock('ai', () => ({
  generateText: jest.fn(),
}));

jest.mock('@/lib/incrementAndLogTokenUsage', () => ({
  incrementAndLogTokenUsage: jest.fn(),
}));

jest.mock('@/lib/models', () => ({
  getVisionModel: jest.fn(),
}));

jest.mock('@/lib/handleAuthorization', () => ({
  handleAuthorizationV2: jest.fn().mockResolvedValue({ userId: 'test-user-id' }),
}));

describe('POST /api/(newai)/vision', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getVisionModel as jest.Mock).mockReturnValue({ modelId: 'gpt-4o-mini' });
    (incrementAndLogTokenUsage as jest.Mock).mockResolvedValue({
      remaining: 1000,
      usageError: false,
    });
  });

  describe('Happy Path', () => {
    it('should extract text from image and return text', async () => {
      const mockResponse = {
        text: 'Extracted text from image',
        usage: { totalTokens: 200 },
      };
      (generateText as jest.Mock).mockResolvedValueOnce(mockResponse);

      const imageBuffer = new ArrayBuffer(8);
      const request = new NextRequest('http://localhost:3000/api/vision', {
        method: 'POST',
        body: JSON.stringify({
          image: imageBuffer,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.text).toBe('Extracted text from image');
      expect(generateText).toHaveBeenCalled();
      expect(getVisionModel).toHaveBeenCalled();
      expect(incrementAndLogTokenUsage).toHaveBeenCalledWith(
        'test-user-id',
        200
      );
    });

    it('should use default instruction when no custom instructions provided', async () => {
      const mockResponse = {
        text: 'Extracted text',
        usage: { totalTokens: 150 },
      };
      (generateText as jest.Mock).mockResolvedValueOnce(mockResponse);

      const imageBuffer = new ArrayBuffer(8);
      const request = new NextRequest('http://localhost:3000/api/vision', {
        method: 'POST',
        body: JSON.stringify({
          image: imageBuffer,
        }),
      });

      await POST(request);

      const callArgs = (generateText as jest.Mock).mock.calls[0][0];
      expect(callArgs.messages[0].content[0].text).toContain(
        'Extract all text from the image comprehensively'
      );
      expect(callArgs.messages[0].content[0].text).toContain(
        'Respond with only the extracted text'
      );
    });

    it('should use custom instructions when provided', async () => {
      const mockResponse = {
        text: 'Extracted text',
        usage: { totalTokens: 150 },
      };
      (generateText as jest.Mock).mockResolvedValueOnce(mockResponse);

      const imageBuffer = new ArrayBuffer(8);
      const request = new NextRequest('http://localhost:3000/api/vision', {
        method: 'POST',
        body: JSON.stringify({
          image: imageBuffer,
          instructions: 'Focus on handwritten text only',
        }),
      });

      await POST(request);

      const callArgs = (generateText as jest.Mock).mock.calls[0][0];
      expect(callArgs.messages[0].content[0].text).toContain(
        'Focus on handwritten text only'
      );
    });

    it('should include image in message content', async () => {
      const mockResponse = {
        text: 'Extracted text',
        usage: { totalTokens: 150 },
      };
      (generateText as jest.Mock).mockResolvedValueOnce(mockResponse);

      const imageBuffer = new ArrayBuffer(8);
      const request = new NextRequest('http://localhost:3000/api/vision', {
        method: 'POST',
        body: JSON.stringify({
          image: imageBuffer,
        }),
      });

      await POST(request);

      const callArgs = (generateText as jest.Mock).mock.calls[0][0];
      expect(callArgs.messages[0].content).toHaveLength(2);
      expect(callArgs.messages[0].content[1].type).toBe('image');
      // Image is converted to base64 or processed, so we just check it exists
      expect(callArgs.messages[0].content[1].image).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle authentication failures', async () => {
      const { handleAuthorizationV2 } = require('@/lib/handleAuthorization');
      const authError = new Error('Unauthorized') as any;
      authError.status = 401;
      handleAuthorizationV2.mockRejectedValueOnce(authError);

      const request = new NextRequest('http://localhost:3000/api/vision', {
        method: 'POST',
        body: JSON.stringify({
          image: new ArrayBuffer(8),
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toEqual({ error: 'Unauthorized' });
      expect(generateText).not.toHaveBeenCalled();
    });

    it('should handle AI service errors', async () => {
      (generateText as jest.Mock).mockRejectedValueOnce(
        new Error('AI service unavailable')
      );

      const request = new NextRequest('http://localhost:3000/api/vision', {
        method: 'POST',
        body: JSON.stringify({
          image: new ArrayBuffer(8),
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.error).toBe('AI service unavailable');
    });

    it('should handle errors with status codes', async () => {
      const error = new Error('Rate limit exceeded') as any;
      error.status = 429;
      (generateText as jest.Mock).mockRejectedValueOnce(error);

      const request = new NextRequest('http://localhost:3000/api/vision', {
        method: 'POST',
        body: JSON.stringify({
          image: new ArrayBuffer(8),
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.error).toBe('Rate limit exceeded');
    });

    it('should handle token increment errors gracefully', async () => {
      const mockResponse = {
        text: 'Extracted text',
        usage: { totalTokens: 150 },
      };
      (generateText as jest.Mock).mockResolvedValueOnce(mockResponse);
      (incrementAndLogTokenUsage as jest.Mock).mockRejectedValueOnce(
        new Error('Token increment failed')
      );

      const request = new NextRequest('http://localhost:3000/api/vision', {
        method: 'POST',
        body: JSON.stringify({
          image: new ArrayBuffer(8),
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.error).toBe('Token increment failed');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty instructions string', async () => {
      const mockResponse = {
        text: 'Extracted text',
        usage: { totalTokens: 150 },
      };
      (generateText as jest.Mock).mockResolvedValueOnce(mockResponse);

      const imageBuffer = new ArrayBuffer(8);
      const request = new NextRequest('http://localhost:3000/api/vision', {
        method: 'POST',
        body: JSON.stringify({
          image: imageBuffer,
          instructions: '',
        }),
      });

      await POST(request);

      const callArgs = (generateText as jest.Mock).mock.calls[0][0];
      // Should use default instruction when empty string
      expect(callArgs.messages[0].content[0].text).toContain(
        'Extract all text from the image comprehensively'
      );
    });

    it('should handle whitespace-only instructions', async () => {
      const mockResponse = {
        text: 'Extracted text',
        usage: { totalTokens: 150 },
      };
      (generateText as jest.Mock).mockResolvedValueOnce(mockResponse);

      const imageBuffer = new ArrayBuffer(8);
      const request = new NextRequest('http://localhost:3000/api/vision', {
        method: 'POST',
        body: JSON.stringify({
          image: imageBuffer,
          instructions: '   ',
        }),
      });

      await POST(request);

      const callArgs = (generateText as jest.Mock).mock.calls[0][0];
      // Should use default instruction when only whitespace
      expect(callArgs.messages[0].content[0].text).toContain(
        'Extract all text from the image comprehensively'
      );
    });

    it('should handle missing request body', async () => {
      const request = new NextRequest('http://localhost:3000/api/vision', {
        method: 'POST',
      });

      const response = await POST(request);
      const data = await response.json();

      // vision route returns status 200 when error.status is undefined
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('error');
    });

    it('should handle invalid JSON in request body', async () => {
      const request = new NextRequest('http://localhost:3000/api/vision', {
        method: 'POST',
        body: 'invalid json',
      });

      const response = await POST(request);
      const data = await response.json();

      // vision route returns status 200 when error.status is undefined
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('error');
    });

    it('should handle zero tokens', async () => {
      const mockResponse = {
        text: 'Extracted text',
        usage: { totalTokens: 0 },
      };
      (generateText as jest.Mock).mockResolvedValueOnce(mockResponse);

      const request = new NextRequest('http://localhost:3000/api/vision', {
        method: 'POST',
        body: JSON.stringify({
          image: new ArrayBuffer(8),
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(incrementAndLogTokenUsage).toHaveBeenCalledWith(
        'test-user-id',
        0
      );
    });
  });
});

