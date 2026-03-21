import { DEFAULT_SETTINGS, ZenithAISettings } from './settings';

describe('DEFAULT_SETTINGS', () => {
  it('is an instance of ZenithAISettings', () => {
    expect(DEFAULT_SETTINGS).toBeInstanceOf(ZenithAISettings);
  });

  it('has correct defaults for all settings', () => {
    expect(DEFAULT_SETTINGS.providerKeys).toEqual([]);
    expect(DEFAULT_SETTINGS.modelConfigs).toEqual([]);
    expect(DEFAULT_SETTINGS.activeModelConfigId).toBe('');
    expect(DEFAULT_SETTINGS.selfHostingURL).toBe('http://localhost:3010');
    expect(DEFAULT_SETTINGS.debugMode).toBe(false);
  });

  it('has exactly 5 keys', () => {
    expect(Object.keys(DEFAULT_SETTINGS)).toHaveLength(5);
  });
});
