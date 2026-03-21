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

describe('ZenithAISettings', () => {
  it('instances are independent — mutating one does not affect another', () => {
    const a = new ZenithAISettings();
    const b = new ZenithAISettings();
    a.activeModelConfigId = 'config-a';
    a.debugMode = true;
    expect(b.activeModelConfigId).toBe('');
    expect(b.debugMode).toBe(false);
  });

  it('providerKeys and modelConfigs are fresh arrays not shared with DEFAULT_SETTINGS', () => {
    const settings = new ZenithAISettings();
    expect(settings.providerKeys).not.toBe(DEFAULT_SETTINGS.providerKeys);
    expect(settings.modelConfigs).not.toBe(DEFAULT_SETTINGS.modelConfigs);
    const lenBefore = DEFAULT_SETTINGS.providerKeys.length;
    settings.providerKeys.push({ id: 'x', name: 'X', provider: 'openai', apiKey: 'k' });
    expect(DEFAULT_SETTINGS.providerKeys).toHaveLength(lenBefore);
  });

  it('has the same default values as DEFAULT_SETTINGS', () => {
    const settings = new ZenithAISettings();
    expect(settings.providerKeys).toEqual(DEFAULT_SETTINGS.providerKeys);
    expect(settings.modelConfigs).toEqual(DEFAULT_SETTINGS.modelConfigs);
    expect(settings.activeModelConfigId).toBe(DEFAULT_SETTINGS.activeModelConfigId);
    expect(settings.selfHostingURL).toBe(DEFAULT_SETTINGS.selfHostingURL);
    expect(settings.debugMode).toBe(DEFAULT_SETTINGS.debugMode);
  });

  it('activeModelConfigId can be set and retrieved', () => {
    const settings = new ZenithAISettings();
    settings.activeModelConfigId = 'some-config-id';
    expect(settings.activeModelConfigId).toBe('some-config-id');
  });

  it('debugMode defaults to false and can be toggled', () => {
    const settings = new ZenithAISettings();
    expect(settings.debugMode).toBe(false);
    settings.debugMode = true;
    expect(settings.debugMode).toBe(true);
    settings.debugMode = false;
    expect(settings.debugMode).toBe(false);
  });
});
