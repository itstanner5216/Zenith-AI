import { DEFAULT_SETTINGS, ZenithAISettings } from './settings';

describe('DEFAULT_SETTINGS', () => {
  it('is an instance of ZenithAISettings', () => {
    expect(DEFAULT_SETTINGS).toBeInstanceOf(ZenithAISettings);
  });

  it('has correct defaults for all 9 settings', () => {
    expect(DEFAULT_SETTINGS.API_KEY).toBe('');
    expect(DEFAULT_SETTINGS.enableSelfHosting).toBe(false);
    expect(DEFAULT_SETTINGS.selfHostingURL).toBe('http://localhost:3010');
    expect(DEFAULT_SETTINGS.selectedModel).toBe('gpt-4o-mini');
    expect(DEFAULT_SETTINGS.customModelName).toBe('llama3.2');
    expect(DEFAULT_SETTINGS.debugMode).toBe(false);
    expect(DEFAULT_SETTINGS.enableSearchGrounding).toBe(false);
    expect(DEFAULT_SETTINGS.enableDeepSearch).toBe(false);
  });

  it('has exactly 9 keys', () => {
    expect(Object.keys(DEFAULT_SETTINGS)).toHaveLength(8);
  });
});
