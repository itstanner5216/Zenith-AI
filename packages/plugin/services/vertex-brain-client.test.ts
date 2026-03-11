// Mock dependencies FIRST, before imports
jest.mock('../services/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

jest.mock('obsidian', () => ({
  requestUrl: jest.fn(),
  Notice: jest.fn(),
}));

import { requestUrl } from 'obsidian';
import { VertexBrainClient } from './vertex-brain-client';

describe('VertexBrainClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('normalizes trailing slash in base URL', async () => {
    (requestUrl as jest.Mock).mockResolvedValue({ json: { status: 'healthy' } });
    const client = new VertexBrainClient('http://localhost:8085/');

    await client.health();

    expect(requestUrl).toHaveBeenCalledWith(expect.objectContaining({
      url: 'http://localhost:8085/health',
    }));
  });

  it('returns true from health when status is not unhealthy', async () => {
    (requestUrl as jest.Mock).mockResolvedValue({ json: { status: 'healthy' } });
    const client = new VertexBrainClient('http://localhost:8085');

    await expect(client.health()).resolves.toBe(true);
  });

  it('returns false from health when request fails', async () => {
    (requestUrl as jest.Mock).mockRejectedValue(new Error('unreachable'));
    const client = new VertexBrainClient('http://localhost:8085');

    await expect(client.health()).resolves.toBe(false);
  });

  it('caps embed text to 8000 chars', async () => {
    (requestUrl as jest.Mock).mockResolvedValue({ json: { embedding: [0.1, 0.2, 0.3] } });
    const client = new VertexBrainClient('http://localhost:8085');

    const longText = 'a'.repeat(9000);
    const embedding = await client.embed(longText);

    expect(embedding).toEqual([0.1, 0.2, 0.3]);
    expect(requestUrl).toHaveBeenCalledWith(expect.objectContaining({
      url: 'http://localhost:8085/v1/embed',
      method: 'POST',
      body: JSON.stringify({ text: 'a'.repeat(8000) }),
    }));
  });

  it('sends vector-upsert payload as-is', async () => {
    (requestUrl as jest.Mock).mockResolvedValue({ json: { indexed: true } });
    const client = new VertexBrainClient('http://localhost:8085');

    const payload = { id: 'id-1', content: 'c', folder_path: 'Projects', tags: ['one'] };
    await expect(client.vectorUpsert(payload)).resolves.toEqual({ indexed: true });

    expect(requestUrl).toHaveBeenCalledWith(expect.objectContaining({
      url: 'http://localhost:8085/v1/vector-upsert',
      method: 'POST',
      body: JSON.stringify(payload),
    }));
  });

  it('applies default vector-search limit of 20', async () => {
    (requestUrl as jest.Mock).mockResolvedValue({ json: { results: [{ id: '1' }] } });
    const client = new VertexBrainClient('http://localhost:8085');

    await client.vectorSearch('test');

    expect(requestUrl).toHaveBeenCalledWith(expect.objectContaining({
      url: 'http://localhost:8085/v1/vector-search',
      body: JSON.stringify({ query: 'test', limit: 20 }),
    }));
  });

  it('caps vector-search query to 4000 chars and returns empty array fallback', async () => {
    (requestUrl as jest.Mock).mockResolvedValue({ json: {} });
    const client = new VertexBrainClient('http://localhost:8085');

    const result = await client.vectorSearch('q'.repeat(5000), 5);

    expect(result).toEqual([]);
    expect(requestUrl).toHaveBeenCalledWith(expect.objectContaining({
      body: JSON.stringify({ query: 'q'.repeat(4000), limit: 5 }),
    }));
  });

  it('maps rank grounding_support into title/score records', async () => {
    (requestUrl as jest.Mock).mockResolvedValue({
      json: { grounding_support: [{ segment: 'A', score: 0.9 }, { segment: 'B', score: 0.4 }] },
    });
    const client = new VertexBrainClient('http://localhost:8085');

    const ranked = await client.rank('query', [{ id: '1', title: 'T', content: 'C' }]);

    expect(ranked).toEqual([
      { title: 'A', score: 0.9 },
      { title: 'B', score: 0.4 },
    ]);
  });

  it('returns empty list when ranking response has no grounding_support', async () => {
    (requestUrl as jest.Mock).mockResolvedValue({ json: {} });
    const client = new VertexBrainClient('http://localhost:8085');

    await expect(client.rank('query', [])).resolves.toEqual([]);
  });

  it('sends answer request in vault mode and includes optional session_id', async () => {
    (requestUrl as jest.Mock).mockResolvedValue({ json: { answer: 'ok', citations: [] } });
    const client = new VertexBrainClient('http://localhost:8085');

    await client.answer('where', 'session-1');

    expect(requestUrl).toHaveBeenCalledWith(expect.objectContaining({
      url: 'http://localhost:8085/v1/answer',
      body: JSON.stringify({ query: 'where', session_id: 'session-1', mode: 'vault' }),
    }));
  });
});
