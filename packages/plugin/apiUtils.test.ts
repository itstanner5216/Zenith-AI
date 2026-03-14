// Mock someUtils to avoid logger import issues
jest.mock('./someUtils', () => ({
  logMessage: jest.fn(),
  logError: jest.fn(),
  sanitizeTag: jest.fn((tag: string) => tag.startsWith('#') ? tag : `#${tag}`),
  formatToSafeName: jest.fn((format: string) => format),
  sanitizeFileName: jest.fn((fileName: string) => fileName),
  cleanPath: jest.fn((path: string) => path),
}));

// Mock Obsidian
jest.mock('obsidian', () => ({
  Notice: jest.fn(),
}));

import { makeApiRequest } from './apiUtils';
import { Notice } from 'obsidian';

describe('apiUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('makeApiRequest', () => {
    it('should return JSON data for successful responses (2xx)', async () => {
      const mockResponse = {
        status: 200,
        json: { data: 'test data' },
      };

      const requestFn = jest.fn().mockResolvedValue(mockResponse);

      const result = await makeApiRequest(requestFn);

      expect(result).toEqual({ data: 'test data' });
      expect(requestFn).toHaveBeenCalledTimes(1);
    });

    it('should throw error with message from response.json.error', async () => {
      const mockResponse = {
        status: 400,
        json: { error: 'Token limit exceeded' },
      };

      const requestFn = jest.fn().mockResolvedValue(mockResponse);

      await expect(makeApiRequest(requestFn)).rejects.toThrow('Token limit exceeded');
      expect(Notice).toHaveBeenCalledWith('File Organizer error: Token limit exceeded', 6000);
    });

    it('should throw "Unknown error" when response has no error field', async () => {
      const mockResponse = {
        status: 500,
        json: { message: 'Something went wrong' },
      };

      const requestFn = jest.fn().mockResolvedValue(mockResponse);

      await expect(makeApiRequest(requestFn)).rejects.toThrow('Unknown error');
    });

    it('should handle 3xx status codes as errors', async () => {
      const mockResponse = {
        status: 301,
        json: { error: 'Redirect error' },
      };

      const requestFn = jest.fn().mockResolvedValue(mockResponse);

      await expect(makeApiRequest(requestFn)).rejects.toThrow('Redirect error');
    });

    it('should handle 4xx status codes as errors', async () => {
      const mockResponse = {
        status: 401,
        json: { error: 'Unauthorized' },
      };

      const requestFn = jest.fn().mockResolvedValue(mockResponse);

      await expect(makeApiRequest(requestFn)).rejects.toThrow('Unauthorized');
      expect(Notice).toHaveBeenCalledWith('File Organizer error: Unauthorized', 6000);
    });

    it('should handle 5xx status codes as errors', async () => {
      const mockResponse = {
        status: 500,
        json: { error: 'Internal server error' },
      };

      const requestFn = jest.fn().mockResolvedValue(mockResponse);

      await expect(makeApiRequest(requestFn)).rejects.toThrow('Internal server error');
      expect(Notice).toHaveBeenCalledWith('File Organizer error: Internal server error', 6000);
    });

    it('should handle empty error messages gracefully', async () => {
      const mockResponse = {
        status: 400,
        json: { error: '' },
      };

      const requestFn = jest.fn().mockResolvedValue(mockResponse);

      // Empty string is falsy, so it falls through to "Unknown error"
      await expect(makeApiRequest(requestFn)).rejects.toThrow('Unknown error');
      // Notice should not be called for empty error (falsy check)
      expect(Notice).not.toHaveBeenCalled();
    });
  });
});
