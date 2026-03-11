import { DEFAULT_SETTINGS, ZenithAISettings } from './settings';

describe('DEFAULT_SETTINGS', () => {
  it('is an instance of ZenithAISettings', () => {
    expect(DEFAULT_SETTINGS).toBeInstanceOf(ZenithAISettings);
  });

  it('matches the snapshot', () => {
    expect(DEFAULT_SETTINGS).toMatchSnapshot();
  });

  it('has critical default values', () => {
    expect(DEFAULT_SETTINGS.vertexBrainUrl).toBe('http://localhost:8085');
    expect(DEFAULT_SETTINGS.enableVectorAutoSort).toBe(true);
    expect(DEFAULT_SETTINGS.autoSortConfidenceThreshold).toBe(0.75);
    expect(DEFAULT_SETTINGS.API_KEY).toBe('');
    expect(DEFAULT_SETTINGS.pathToWatch).toBe('_ZenithAI/Inbox');
    expect(DEFAULT_SETTINGS.defaultDestinationPath).toBe('_ZenithAI/Processed');
    expect(DEFAULT_SETTINGS.backgroundScribeEnabled).toBe(false);
    expect(DEFAULT_SETTINGS.pinnedTag).toBe('pinned');
    expect(DEFAULT_SETTINGS.selectedModel).toBe('gpt-4o-mini');
    expect(DEFAULT_SETTINGS.debugMode).toBe(false);
  });
});
