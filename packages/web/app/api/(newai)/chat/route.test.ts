import { NextRequest } from 'next/server';
import { POST } from './route';

// Mock the AI SDK
/* eslint-disable @typescript-eslint/no-unused-vars */
jest.mock('ai', () => {
  return {
    streamText: jest.fn().mockImplementation(async (options: any) => {
      const mockResult = {
        mergeIntoDataStream: jest.fn(async (dataStream: any) => {
          // Simulate streaming some data
          dataStream.writeData('test response');

          // If onFinish callback exists, call it synchronously (it will be awaited)
          if (options?.onFinish) {
            // Simulate sources for search mode
            if (options?.tools?.web_search_preview) {
              // Call onFinish with sources for search mode
              await options.onFinish({
                usage: { totalTokens: 100 },
                sources: [
                  { url: 'https://example.com', title: 'Example Website' },
                ],
              });
            } else {
              // For non-search mode, still call onFinish but without sources
              await options.onFinish({
                usage: { totalTokens: 100 },
              });
            }
          }
        }),
        toDataStreamResponse: jest.fn(() => new Response()),
      };
      return mockResult;
    }),
    convertToCoreMessages: jest.fn(
      (
        messages: Array<{
          role: string;
          content: string;
          toolInvocations?: Array<{
            toolCallId: string;
            toolName: string;
            result: string;
          }>;
        }>
      ) => {
        // Simulate conversion - if message has toolInvocations, create tool messages
        // Tool messages should NOT have toolCallId/toolName at top level (so code can extract from content)
        const coreMessages: Array<{
          role: string;
          content:
            | string
            | Array<{
                type: string;
                toolCallId: string;
                toolName: string;
                result: string;
              }>;
        }> = [];
        messages.forEach((msg) => {
          // Add the original message (user/assistant)
          const { toolInvocations, ...messageWithoutToolInvocations } = msg;
          coreMessages.push(messageWithoutToolInvocations as any);

          // Create tool messages from toolInvocations
          if (msg.toolInvocations) {
            msg.toolInvocations.forEach((tool) => {
              coreMessages.push({
                role: 'tool',
                // Don't include toolCallId/toolName at top level - code extracts from content
                content: [
                  {
                    type: 'tool-result',
                    toolCallId: tool.toolCallId,
                    toolName: tool.toolName,
                    result: tool.result,
                  },
                ],
              } as any);
            });
          }
        });
        return coreMessages;
      }
    ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createDataStreamResponse: jest.fn((options: any) => {
      const annotations: any[] = [];
      let controllerRef: ReadableStreamDefaultController<any> | null = null;
      const mockStream = new ReadableStream({
        start(controller) {
          controllerRef = controller;
          // Execute the handler asynchronously
          Promise.resolve().then(async () => {
            try {
              await options.execute({
                writeData: (data: any) => {
                  // Write data to stream if controller is still open
                  if (controllerRef && controllerRef.desiredSize !== null) {
                    const encoder = new TextEncoder();
                    controllerRef.enqueue(
                      encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
                    );
                  }
                },
                writeMessageAnnotation: (annotation: any) => {
                  // Store annotation and write to stream if controller is still open
                  if (controllerRef && controllerRef.desiredSize !== null) {
                    annotations.push(annotation);
                    const encoder = new TextEncoder();
                    controllerRef.enqueue(
                      encoder.encode(
                        `data: ${JSON.stringify({
                          type: 'metadata',
                          data: annotation,
                        })}\n\n`
                      )
                    );
                  }
                },
              });
              // Wait a bit for any async onFinish callbacks to complete
              await new Promise((resolve) => setTimeout(resolve, 50));
              if (controllerRef) {
                controllerRef.close();
              }
            } catch (err) {
              if (controllerRef) {
                controllerRef.error(err);
              }
            }
          });
        },
      });
      return new Response(mockStream, {
        headers: { 'Content-Type': 'text/event-stream' },
      });
    }),
  };
});
/* eslint-enable @typescript-eslint/no-unused-vars */

// Mock the OpenAI SDK
jest.mock('@ai-sdk/openai', () => ({
  openai: Object.assign(
    jest.fn(() => ({
      generateText: jest.fn().mockImplementation(async () => ({
        text: 'Test response',
        experimental_providerMetadata: {
          openai: {
            annotations: [
              {
                type: 'url_citation',
                url_citation: {
                  url: 'https://example.com',
                  title: 'Example Website',
                  start_index: 10,
                  end_index: 20,
                },
              },
            ],
          },
        },
      })),
    })),
    {
      tools: {
        webSearchPreview: jest.fn((options: any) => ({
          type: 'web_search_preview',
          searchContextSize: options?.searchContextSize || 'medium',
        })),
      },
      responses: jest.fn((model: string) => ({
        generateText: jest.fn(),
        streamText: jest.fn(),
      })),
    }
  ),
}));

describe('Chat API Route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should include citation metadata in response', async () => {
    const mockRequest = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        messages: [
          { role: 'user', content: "What's the latest news about AI?" },
        ],
        model: 'gpt-4o-search-preview',
        enableSearchGrounding: true,
      }),
      headers: {
        'x-user-id': 'test-user',
      },
    });

    const response = await POST(mockRequest);
    expect(response instanceof Response).toBe(true);

    // Wait a bit for async operations (onFinish callback)
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Read the stream and check for metadata
    const reader = (response as Response).body?.getReader();
    if (!reader) throw new Error('No response body');

    let foundMetadata = false;
    let done = false;
    while (!done) {
      const result = await reader.read();
      done = result.done;
      if (done) break;
      const { value } = result;

      const chunk = new TextDecoder().decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(5));
            if (data.type === 'metadata' && data.data?.citations) {
              foundMetadata = true;
              break;
            }
          } catch (e) {
            // Ignore parse errors for non-JSON data
          }
        }
      }
      if (foundMetadata) break;
    }

    expect(foundMetadata).toBe(true);
  });

  it('should log tool-result preview content for tool messages', async () => {
    const mockRequest = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content: 'Open the architecture note and summarize it.',
          },
          {
            role: 'assistant',
            content: '',
            toolInvocations: [
              {
                toolCallId: 'call_test123',
                toolName: 'openFile',
                state: 'result',
                args: { filePath: 'Architecture.md' },
                result: 'Opened Architecture.md and loaded 2,300 characters.',
              },
            ],
          },
        ],
        // Don't enable search mode so it goes to the non-search path that processes tool messages
        enableSearchGrounding: false,
      }),
      headers: {
        'x-user-id': 'test-user',
      },
    });

    // Mock console.log to capture tool result extraction
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

    const response = await POST(mockRequest);
    expect(response instanceof Response).toBe(true);

    // Wait a bit for async operations
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Check that tool result preview logging happened
    const previewLog = consoleLogSpy.mock.calls.find((call) =>
      call[0]?.includes('content that model will see')
    );
    expect(previewLog).toBeDefined();

    consoleLogSpy.mockRestore();
  });

  it('should extract toolCallId and toolName from tool message array content', async () => {
    const mockRequest = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        messages: [
          { role: 'user', content: 'Test message' },
          {
            role: 'assistant',
            content: '',
            toolInvocations: [
              {
                toolCallId: 'call_test456',
                toolName: 'openFile',
                state: 'result',
                args: { filePath: 'Notes/Test.md' },
                result: 'Loaded note content for Notes/Test.md',
              },
            ],
          },
        ],
        // Don't enable search mode so it goes to the non-search path that processes tool messages
        enableSearchGrounding: false,
      }),
      headers: {
        'x-user-id': 'test-user',
      },
    });

    // Mock console.log to capture the extraction
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

    const response = await POST(mockRequest);
    expect(response instanceof Response).toBe(true);

    // Wait a bit for async operations
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Check that toolCallId/toolName extraction was logged
    const extractionLog = consoleLogSpy.mock.calls.find((call) =>
      call[0]?.includes('Extracting toolCallId/toolName from content array')
    );
    expect(extractionLog).toBeDefined();

    consoleLogSpy.mockRestore();
  });
});
