import { ErrorService, ErrorSeverity, withErrorHandling } from './error-service';
import { Notice } from 'obsidian';
import { logger } from '../../services/logger';

// Mock Obsidian
jest.mock('obsidian', () => ({
  Notice: jest.fn(),
}));

// Mock logger
jest.mock('../../services/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('ErrorService', () => {
  let errorService: ErrorService;

  beforeEach(() => {
    // Reset singleton instance
    (ErrorService as any).instance = undefined;
    errorService = ErrorService.getInstance();
    errorService.clearErrors();
    errorService.disableDebug();
    jest.clearAllMocks();
  });

  describe('getInstance', () => {
    it('should return the same instance (singleton)', () => {
      const instance1 = ErrorService.getInstance();
      const instance2 = ErrorService.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe('handleError', () => {
    it('should log error without notification when shouldNotify is false', () => {
      errorService.handleError({
        message: 'Test error',
        severity: ErrorSeverity.LOW,
        shouldNotify: false,
      });

      const errors = errorService.getRecentErrors();
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe('Test error');
      expect(Notice).not.toHaveBeenCalled();
    });

    it('should show notification when shouldNotify is true', () => {
      errorService.handleError({
        message: 'Critical error',
        severity: ErrorSeverity.CRITICAL,
        shouldNotify: true,
      });

      expect(Notice).toHaveBeenCalledWith('ZenithAI: Critical error', 10000);
    });

    it('should log error with context', () => {
      errorService.handleError({
        message: 'Error with context',
        severity: ErrorSeverity.MEDIUM,
        context: { userId: '123', action: 'process' },
      });

      const errors = errorService.getRecentErrors();
      expect(errors[0].context).toMatchObject({
        userId: '123',
        action: 'process',
        timestamp: expect.any(String),
      });
    });

    it('should limit error log size to MAX_LOG_SIZE', () => {
      // Add more than MAX_LOG_SIZE errors
      for (let i = 0; i < 150; i++) {
        errorService.handleError({
          message: `Error ${i}`,
          severity: ErrorSeverity.LOW,
        });
      }

      const errors = errorService.getRecentErrors();
      expect(errors.length).toBeLessThanOrEqual(100);
    });

    it('should log to console when debug is enabled', () => {
      errorService.enableDebug();

      errorService.handleError({
        message: 'Debug error',
        severity: ErrorSeverity.MEDIUM,
      });

      expect(logger.error).toHaveBeenCalledWith(
        '[ZenithAI Error]',
        expect.objectContaining({
          message: 'Debug error',
          severity: ErrorSeverity.MEDIUM,
          timestamp: expect.any(String),
        })
      );
    });

    it('should not log to console when debug is disabled', () => {
      errorService.disableDebug();

      errorService.handleError({
        message: 'Debug error',
        severity: ErrorSeverity.MEDIUM,
      });

      expect(logger.error).not.toHaveBeenCalled();
    });
  });

  describe('getNotificationDuration', () => {
    it('should return correct duration for CRITICAL severity', () => {
      errorService.handleError({
        message: 'Critical',
        severity: ErrorSeverity.CRITICAL,
        shouldNotify: true,
      });

      expect(Notice).toHaveBeenCalledWith('ZenithAI: Critical', 10000);
    });

    it('should return correct duration for HIGH severity', () => {
      errorService.handleError({
        message: 'High',
        severity: ErrorSeverity.HIGH,
        shouldNotify: true,
      });

      expect(Notice).toHaveBeenCalledWith('ZenithAI: High', 5000);
    });

    it('should return correct duration for MEDIUM severity', () => {
      errorService.handleError({
        message: 'Medium',
        severity: ErrorSeverity.MEDIUM,
        shouldNotify: true,
      });

      expect(Notice).toHaveBeenCalledWith('ZenithAI: Medium', 3000);
    });

    it('should return correct duration for LOW severity', () => {
      errorService.handleError({
        message: 'Low',
        severity: ErrorSeverity.LOW,
        shouldNotify: true,
      });

      expect(Notice).toHaveBeenCalledWith('ZenithAI: Low', 2000);
    });
  });

  describe('helper methods', () => {
    it('handleFileOperationError should create error with correct properties', () => {
      const error = new Error('File not found');
      errorService.handleFileOperationError('move', '/path/to/file', error);

      const errors = errorService.getRecentErrors();
      expect(errors[0]).toMatchObject({
        message: 'Failed to move file: /path/to/file',
        severity: ErrorSeverity.HIGH,
        context: { operation: 'move', path: '/path/to/file' },
        error,
        shouldNotify: true,
      });
    });

    it('handleAPIError should create error with correct properties', () => {
      const error = new Error('Network error');
      errorService.handleAPIError('/api/classify', error);

      const errors = errorService.getRecentErrors();
      expect(errors[0]).toMatchObject({
        message: 'API request failed: /api/classify',
        severity: ErrorSeverity.MEDIUM,
        context: { endpoint: '/api/classify' },
        error,
        shouldNotify: false,
      });
    });

    it('handleProcessingError should create error with correct properties', () => {
      const error = new Error('Processing failed');
      errorService.handleProcessingError('document.pdf', error);

      const errors = errorService.getRecentErrors();
      expect(errors[0]).toMatchObject({
        message: 'Error processing file: document.pdf',
        severity: ErrorSeverity.HIGH,
        context: { fileName: 'document.pdf' },
        error,
        shouldNotify: true,
      });
    });
  });

  describe('clearErrors', () => {
    it('should clear all errors', () => {
      errorService.handleError({
        message: 'Error 1',
        severity: ErrorSeverity.LOW,
      });
      errorService.handleError({
        message: 'Error 2',
        severity: ErrorSeverity.LOW,
      });

      expect(errorService.getRecentErrors()).toHaveLength(2);

      errorService.clearErrors();

      expect(errorService.getRecentErrors()).toHaveLength(0);
    });
  });
});

describe('withErrorHandling', () => {
  let errorService: ErrorService;

  beforeEach(() => {
    (ErrorService as any).instance = undefined;
    errorService = ErrorService.getInstance();
    errorService.clearErrors();
    jest.clearAllMocks();
  });

  it('should return result when operation succeeds', async () => {
    const operation = jest.fn().mockResolvedValue('success');

    const result = await withErrorHandling(operation, {
      message: 'Operation failed',
      severity: ErrorSeverity.MEDIUM,
    });

    expect(result).toBe('success');
    expect(errorService.getRecentErrors()).toHaveLength(0);
  });

  it('should return null and handle error when operation fails', async () => {
    const error = new Error('Operation failed');
    const operation = jest.fn().mockRejectedValue(error);

    const result = await withErrorHandling(operation, {
      message: 'Operation failed',
      severity: ErrorSeverity.HIGH,
    });

    expect(result).toBeNull();
    const errors = errorService.getRecentErrors();
    expect(errors).toHaveLength(1);
    expect(errors[0].error).toBe(error);
    expect(errors[0].message).toBe('Operation failed');
  });

  it('should preserve error details in error log', async () => {
    const error = new Error('Custom error');
    const operation = jest.fn().mockRejectedValue(error);

    await withErrorHandling(operation, {
      message: 'Custom operation failed',
      severity: ErrorSeverity.CRITICAL,
      context: { userId: '123' },
    });

    const errors = errorService.getRecentErrors();
    expect(errors[0]).toMatchObject({
      message: 'Custom operation failed',
      severity: ErrorSeverity.CRITICAL,
      context: { userId: '123' },
      error,
    });
  });
});

