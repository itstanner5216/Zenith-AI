jest.mock('obsidian', () => ({
  requestUrl: jest.fn(),
}));

import { requestUrl } from 'obsidian';
import { VertexBrainClient } from './vertex-brain-client';

describe('VertexBrainClient', () => {
  let client: VertexBrainClient;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    client = new VertexBrainClient('http://localhost:8085');
  });

  describe('constructor', () => {
    it('stores baseUrl as-is when no trailing slash', async () => {
      (requestUrl as jest.Mock).mockResolvedValue({ status: 200, json: { status: 'healthy' } });
      const noSlashClient = new VertexBrainClient('http://localhost:8085');

      await noSlashClient.health();

      expect(requestUrl).toHaveBeenCalledWith(expect.objectContaining({
        url: 'http://localhost:8085/health',
      }));
    });

    it('strips trailing slash from baseUrl', async () => {
      (requestUrl as jest.Mock).mockResolvedValue({ status: 200, json: { status: 'healthy' } });
      const slashClient = new VertexBrainClient('http://localhost:8085/');

      await slashClient.health();

      expect(requestUrl).toHaveBeenCalledWith(expect.objectContaining({
        url: 'http://localhost:8085/health',
      }));
    });
  });

  describe('health', () => {
    it('returns true when requestUrl resolves with healthy response', async () => {
      (requestUrl as jest.Mock).mockResolvedValue({ status: 200, json: { status: 'healthy' } });
      await expect(client.health()).resolves.toBe(true);
    });

    it('returns false when requestUrl rejects', async () => {
      (requestUrl as jest.Mock).mockRejectedValue(new Error('network error'));
      await expect(client.health()).resolves.toBe(false);
    });

    it('returns false when requestUrl resolves with unhealthy status', async () => {
      (requestUrl as jest.Mock).mockResolvedValue({ status: 200, json: { status: 'unhealthy' } });
      await expect(client.health()).resolves.toBe(false);
    });

    it('uses a 5000ms timeout and calls GET /health', async () => {
      jest.useFakeTimers();
      (requestUrl as jest.Mock).mockReturnValue(new Promise(() => {}));

      const pending = client.health();
      await jest.advanceTimersByTimeAsync(5001);

      await expect(pending).resolves.toBe(false);
      expect(requestUrl).toHaveBeenCalledWith({ url: 'http://localhost:8085/health' });
    });
  });

  describe('embed', () => {
    it('sends POST /v1/embed and returns embedding', async () => {
      (requestUrl as jest.Mock).mockResolvedValue({ json: { embedding: [0.1, 0.2] } });

      const result = await client.embed('hello');

      expect(result).toEqual([0.1, 0.2]);
      expect(requestUrl).toHaveBeenCalledWith(expect.objectContaining({
        url: 'http://localhost:8085/v1/embed',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }));
      expect(JSON.parse((requestUrl as jest.Mock).mock.calls[0][0].body)).toEqual({ text: 'hello' });
    });

    it('truncates text to 8000 chars before sending', async () => {
      (requestUrl as jest.Mock).mockResolvedValue({ json: { embedding: [] } });
      const longText = 'a'.repeat(9000);

      await client.embed(longText);

      const body = JSON.parse((requestUrl as jest.Mock).mock.calls[0][0].body);
      expect(body.text).toHaveLength(8000);
    });

    it('rejects with timeout after 30000ms', async () => {
      jest.useFakeTimers();
      (requestUrl as jest.Mock).mockReturnValue(new Promise(() => {}));

      const pending = client.embed('slow');
      const assertion = expect(pending).rejects.toThrow('Request timed out');
      await jest.advanceTimersByTimeAsync(30001);

      await assertion;
    });

    it('propagates inner promise errors', async () => {
      (requestUrl as jest.Mock).mockRejectedValue(new Error('boom'));
      await expect(client.embed('x')).rejects.toThrow('boom');
    });
  });

  describe('vectorUpsert', () => {
    it('sends POST /v1/vector-upsert, returns parsed json, and uses timeout', async () => {
      (requestUrl as jest.Mock).mockResolvedValue({ json: { indexed: true } });

      const payload = { id: '1', content: 'c', folder_path: 'f', tags: ['t'] };
      const result = await client.vectorUpsert(payload);

      expect(result).toEqual({ indexed: true });
      expect(requestUrl).toHaveBeenCalledWith(expect.objectContaining({
        url: 'http://localhost:8085/v1/vector-upsert',
        method: 'POST',
      }));
      expect(JSON.parse((requestUrl as jest.Mock).mock.calls[0][0].body)).toEqual(payload);

      jest.useFakeTimers();
      (requestUrl as jest.Mock).mockReturnValueOnce(new Promise(() => {}));
      const pending = client.vectorUpsert(payload);
      const assertion = expect(pending).rejects.toThrow('Request timed out');
      await jest.advanceTimersByTimeAsync(30001);
      await assertion;
    });
  });

  describe('vectorSearch', () => {
    it('sends POST /v1/vector-search, returns results, default limit=20, truncates query', async () => {
      (requestUrl as jest.Mock).mockResolvedValue({ json: { results: [{ id: 'a' }] } });
      const longQuery = 'q'.repeat(5000);

      const result = await client.vectorSearch(longQuery);

      expect(result).toEqual([{ id: 'a' }]);
      const body = JSON.parse((requestUrl as jest.Mock).mock.calls[0][0].body);
      expect(body.limit).toBe(20);
      expect(body.query).toHaveLength(4000);
    });

    it('uses provided limit', async () => {
      (requestUrl as jest.Mock).mockResolvedValue({ json: { results: [] } });
      await client.vectorSearch('query', 5);
      const body = JSON.parse((requestUrl as jest.Mock).mock.calls[0][0].body);
      expect(body.limit).toBe(5);
    });
  });

  describe('rank', () => {
    it('maps grounding_support to title/score and falls back to score 0', async () => {
      (requestUrl as jest.Mock).mockResolvedValue({
        json: {
          grounding_support: [
            { segment: 'Doc A', score: 0.7 },
            { segment: 'Doc B' },
          ],
        },
      });

      const result = await client.rank('query', [{ id: '1', title: 't', content: 'c' }]);

      expect(requestUrl).toHaveBeenCalledWith(expect.objectContaining({
        url: 'http://localhost:8085/v1/rank',
        method: 'POST',
      }));
      expect(result).toEqual([
        { title: 'Doc A', score: 0.7 },
        { title: 'Doc B', score: 0 },
      ]);
    });
  });

  describe('answer', () => {
    it('sends POST /v1/answer and returns answer payload', async () => {
      (requestUrl as jest.Mock).mockResolvedValue({
        json: { answer: 'ok', session_id: 's1', citations: [{ title: 'c' }] },
      });

      const result = await client.answer('question', 's1');

      expect(result).toEqual({ answer: 'ok', session_id: 's1', citations: [{ title: 'c' }] });
      expect(JSON.parse((requestUrl as jest.Mock).mock.calls[0][0].body)).toEqual({
        query: 'question',
        session_id: 's1',
        mode: 'vault',
      });
    });

    it('omits session_id when not provided', async () => {
      (requestUrl as jest.Mock).mockResolvedValue({
        json: { answer: 'ok', citations: [] },
      });

      await client.answer('question');

      const body = JSON.parse((requestUrl as jest.Mock).mock.calls[0][0].body);
      expect(body).toEqual({ query: 'question', mode: 'vault' });
      expect(body).not.toHaveProperty('session_id');
    });
  });
});
