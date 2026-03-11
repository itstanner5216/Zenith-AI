jest.mock('./error-service', () => ({
  ErrorSeverity: { HIGH: 'HIGH' },
  ErrorService: {
    getInstance: jest.fn(() => ({
      handleError: jest.fn(),
    })),
  },
}));

const mockGenerateFileHash = jest.fn();
const mockValidateHash = jest.fn();
jest.mock('./id-service', () => ({
  IdService: {
    getInstance: jest.fn(() => ({
      generateFileHash: mockGenerateFileHash,
      validateHash: mockValidateHash,
    })),
  },
}));

jest.mock('obsidian', () => ({
  requestUrl: jest.fn(),
  Notice: jest.fn(),
}));

import { Queue } from './queue';
import { ErrorService } from './error-service';

describe('Queue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockValidateHash.mockReturnValue(true);
  });

  it('processes an added item and emits drain', async () => {
    const onProcess = jest.fn().mockResolvedValue(undefined);
    const onComplete = jest.fn();
    const queue = new Queue<any>({ onProcess, onComplete, concurrency: 1 });
    const drained = new Promise<void>((resolve) => queue.once('drain', () => resolve()));

    mockGenerateFileHash.mockReturnValue('hash-1');
    queue.add({ path: 'foo.md' } as any);
    await drained;

    expect(onProcess).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(queue.getStats()).toMatchObject({ queued: 0, processing: 0, completed: 1, errors: 0 });
  });

  it('records error and calls ErrorService when processing fails', async () => {
    const boom = new Error('boom');
    const onProcess = jest.fn().mockRejectedValue(boom);
    const onError = jest.fn();
    const queue = new Queue<any>({ onProcess, onError, concurrency: 1 });
    const drained = new Promise<void>((resolve) => queue.once('drain', () => resolve()));

    mockGenerateFileHash.mockReturnValue('hash-err');
    queue.add({ path: 'bad.md' } as any);
    await drained;

    const handleError = (ErrorService.getInstance as jest.Mock).mock.results[0].value.handleError;
    expect(handleError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(boom, expect.anything(), expect.objectContaining({ hash: 'hash-err' }));
    expect(queue.getStats()).toMatchObject({ completed: 0, errors: 1 });
  });

  it('can remove queued (non-processing) items', () => {
    const queue = new Queue<any>({ onProcess: jest.fn(() => new Promise(() => {})), concurrency: 1 });
    mockGenerateFileHash.mockReturnValueOnce('hash-running').mockReturnValueOnce('hash-remove');

    queue.add({ path: 'run.md' } as any);
    queue.add({ path: 'remove.md' } as any);

    expect(queue.remove('hash-remove')).toBe(true);
    expect(queue.getItem('hash-remove')).toBeUndefined();
  });

  it('rejects remove and bypass for invalid hashes', () => {
    const queue = new Queue<any>({ onProcess: jest.fn().mockResolvedValue(undefined) });
    mockValidateHash.mockReturnValue(false);

    expect(queue.remove('not-valid')).toBe(false);
    expect(queue.bypass('not-valid')).toBe(false);
  });

  it('bypasses queued item and emits bypass event', () => {
    const queue = new Queue<any>({ onProcess: jest.fn(() => new Promise(() => {})), concurrency: 1 });
    mockGenerateFileHash.mockReturnValueOnce('hash-running').mockReturnValueOnce('hash-bypass');
    const bypassSpy = jest.fn();
    queue.on('bypass', bypassSpy);

    queue.add({ path: 'run.md' } as any);
    queue.add({ path: 'bypass.md' } as any);

    expect(queue.bypass('hash-bypass')).toBe(true);
    expect(bypassSpy).toHaveBeenCalledTimes(1);
    expect(queue.getStats()).toMatchObject({ bypassed: 1 });
  });

  it('resumes processing for queued tasks after manual resume', async () => {
    let releaseFirst: (() => void) | undefined;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const onProcess = jest
      .fn()
      .mockImplementationOnce(() => firstGate)
      .mockResolvedValueOnce(undefined);

    const queue = new Queue<any>({ onProcess, concurrency: 1 });
    const drained = new Promise<void>((resolve) => queue.once('drain', () => resolve()));

    mockGenerateFileHash.mockReturnValueOnce('hash-1').mockReturnValueOnce('hash-2');
    queue.add({ path: '1.md' } as any);
    queue.add({ path: '2.md' } as any);

    queue.pause();
    queue.resume();
    releaseFirst?.();

    await drained;
    expect(onProcess).toHaveBeenCalledTimes(2);
  });
});
