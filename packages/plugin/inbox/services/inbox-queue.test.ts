jest.mock('../../services/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

jest.mock('obsidian', () => ({
  ...jest.requireActual('../../__mocks__/obsidian'),
}));

import { Inbox } from '../index';
import { DEFAULT_SETTINGS } from '../../settings';

describe('Inbox singleton and queue management', () => {
  const mockPlugin = {
    settings: { ...DEFAULT_SETTINGS },
    app: {
      vault: {
        adapter: {
          exists: jest.fn().mockResolvedValue(false),
          read: jest.fn().mockResolvedValue(''),
          mkdir: jest.fn().mockResolvedValue(undefined),
          write: jest.fn().mockResolvedValue(undefined),
        },
        getMarkdownFiles: jest.fn().mockReturnValue([]),
        read: jest.fn().mockResolvedValue(''),
        getAbstractFileByPath: jest.fn().mockReturnValue(null),
        create: jest.fn().mockResolvedValue(undefined),
      },
      metadataCache: { getFileCache: jest.fn().mockReturnValue(null) },
    },
    shouldCreateMarkdownContainer: jest.fn().mockReturnValue(false),
  } as any;

  beforeEach(() => {
    Inbox.cleanup();
    jest.clearAllMocks();
  });

  afterEach(() => {
    Inbox.cleanup();
    jest.clearAllTimers();
  });

  it('initialize returns an Inbox instance', () => {
    const inbox = Inbox.initialize(mockPlugin);
    expect(inbox).toBeInstanceOf(Inbox);
  });

  it('getInstance returns same instance after initialize', () => {
    const first = Inbox.initialize(mockPlugin);
    const second = Inbox.getInstance();
    expect(second).toBe(first);
  });

  it('cleanup resets singleton instance', () => {
    Inbox.initialize(mockPlugin);
    Inbox.cleanup();
    expect(() => Inbox.getInstance()).toThrow('Inbox not initialized');
  });

  it('getQueueStats returns zeroed queue state on fresh inbox', () => {
    const inbox = Inbox.initialize(mockPlugin);
    expect(inbox.getQueueStats()).toEqual({
      queued: 0,
      processing: 0,
      completed: 0,
      errors: 0,
      bypassed: 0,
      total: 0,
    });
  });

  it('getAllFiles returns empty array on fresh inbox', () => {
    const inbox = Inbox.initialize(mockPlugin);
    expect(inbox.getAllFiles()).toEqual([]);
  });

  it('getAnalytics returns expected shape', () => {
    const inbox = Inbox.initialize(mockPlugin);
    const analytics = inbox.getAnalytics();

    expect(analytics).toEqual({
      byStatus: {},
      totalFiles: 0,
      mediaStats: { active: 0, queued: 0 },
      queueStats: {
        queued: 0,
        processing: 0,
        completed: 0,
        errors: 0,
        bypassed: 0,
        total: 0,
      },
    });
  });

  it('enqueueFile increases queue total by 1', () => {
    const inbox = Inbox.initialize(mockPlugin);
    const file = { path: 'Inbox/test.md', basename: 'test', extension: 'md', stat: { mtime: 123 } } as any;

    inbox.enqueueFile(file);

    expect(inbox.getQueueStats().total).toBe(1);
  });
});
