import { NextRequest } from 'next/server';
import { POST } from './route';
import { streamText } from 'ai';
import { getModel } from '@/lib/models';

jest.mock('ai', () => ({
  streamText: jest.fn(),
}));

jest.mock('@/lib/models', () => ({
  getModel: jest.fn(),
}));

jest.mock('@/lib/handleAuthorization', () => ({
  handleAuthorizationV2: jest.fn().mockResolvedValue({ userId: 'test-user-id' }),
}));

describe('POST /api/(newai)/format-stream', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getModel as jest.Mock).mockReturnValue({ modelId: 'gpt-4o-mini' });
    (streamText as jest.Mock).mockResolvedValue({
      toTextStreamResponse: jest.fn(() => new Response('streamed content')),
    });
  });

  it('streams formatted content with a generic prompt', async () => {
    const request = new NextRequest('http://localhost:3000/api/format-stream', {
      method: 'POST',
      body: JSON.stringify({
        content: 'Unformatted content',
        formattingInstruction: 'Format as markdown',
      }),
    });

    const response = await POST(request);
    expect(response).toBeInstanceOf(Response);

    expect(streamText).toHaveBeenCalledTimes(1);
    const args = (streamText as jest.Mock).mock.calls[0][0];
    expect(args.model).toEqual({ modelId: 'gpt-4o-mini' });
    expect(args.system).toBe('Answer directly in markdown');
    expect(args.messages[0].content).toContain(
      'Format the following content according to the given instruction.'
    );
    expect(args.messages[0].content).toContain('Unformatted content');
    expect(args.messages[0].content).toContain('Format as markdown');
  });

  it('does not add youtube-specific transcript instructions anymore', async () => {
    const request = new NextRequest('http://localhost:3000/api/format-stream', {
      method: 'POST',
      body: JSON.stringify({
        content:
          '## YouTube Video Information\nTitle: Demo\n\n## Full Transcript\n\nhello world',
        formattingInstruction: 'Create a summary',
      }),
    });

    await POST(request);

    const args = (streamText as jest.Mock).mock.calls[0][0];
    expect(args.messages[0].content).not.toContain('YouTube video transcript');
    expect(args.messages[0].content).not.toContain('MUST use this transcript');
  });

  it('adds YAML reminder for flash-card formatting', async () => {
    const request = new NextRequest('http://localhost:3000/api/format-stream', {
      method: 'POST',
      body: JSON.stringify({
        content: 'Physics notes',
        formattingInstruction: 'flash_cards',
      }),
    });

    await POST(request);

    const args = (streamText as jest.Mock).mock.calls[0][0];
    expect(args.messages[0].content).toContain(
      'IMPORTANT: When generating frontmatter, use flat YAML format'
    );
  });

  it('includes current datetime in the prompt context', async () => {
    const request = new NextRequest('http://localhost:3000/api/format-stream', {
      method: 'POST',
      body: JSON.stringify({
        content: 'Content',
        formattingInstruction: 'Format',
      }),
    });

    await POST(request);

    const args = (streamText as jest.Mock).mock.calls[0][0];
    expect(args.messages[0].content).toContain('Time:');
    expect(args.messages[0].content).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });

  it('returns auth failures as JSON response', async () => {
    const { handleAuthorizationV2 } = require('@/lib/handleAuthorization');
    const authError = new Error('Unauthorized') as Error & { status?: number };
    authError.status = 401;
    handleAuthorizationV2.mockRejectedValueOnce(authError);

    const request = new NextRequest('http://localhost:3000/api/format-stream', {
      method: 'POST',
      body: JSON.stringify({
        content: 'Content',
        formattingInstruction: 'Format',
      }),
    });

    const response = await POST(request);
    const data = await response?.json();

    expect(response?.status).toBe(401);
    expect(data).toEqual({ error: 'Unauthorized' });
    expect(streamText).not.toHaveBeenCalled();
  });
});
