import { DEFAULT_SETTINGS, ZenithAISettings } from './settings';

describe('settings defaults', () => {
  it('creates a settings object with expected high-impact defaults', () => {
    const settings = new ZenithAISettings();

    expect(settings.defaultDestinationPath).toBe('_ZenithAI/Processed');
    expect(settings.pathToWatch).toBe('_ZenithAI/Inbox');
    expect(settings.enableSelfHosting).toBe(false);
    expect(settings.selfHostingURL).toBe('http://localhost:3010');
    expect(settings.useInbox).toBe(false);
    expect(settings.vertexBrainUrl).toBe('http://localhost:8085');
    expect(settings.enableVectorAutoSort).toBe(true);
  });

  it('keeps bounded numeric defaults stable', () => {
    const settings = new ZenithAISettings();

    expect(settings.contentCutoffChars).toBe(1000);
    expect(settings.maxFormattingTokens).toBe(100000);
    expect(settings.maxChatTokens).toBe(100000);
    expect(settings.pdfPageLimit).toBe(10);
    expect(settings.screenpipeTimeRange).toBe(4);
    expect(settings.queryScreenpipeLimit).toBe(10);
  });

  it('matches the exported DEFAULT_SETTINGS object shape', () => {
    expect(DEFAULT_SETTINGS).toMatchSnapshot();
  });

  it('ensures mutable array defaults are not shared between instances', () => {
    const one = new ZenithAISettings();
    const two = new ZenithAISettings();

    one.ignoreFolders.push('Archive');

    expect(two.ignoreFolders).toEqual(['']);
  });
});
