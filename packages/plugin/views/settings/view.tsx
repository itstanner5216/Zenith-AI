import * as React from 'react';
import { App, PluginSettingTab } from 'obsidian';
import ZenithAI from '../../index';
import { createRoot, Root } from 'react-dom/client';
import { SettingsTabContent } from './main';
import { logMessage } from '../../someUtils';

export class ZenithAISettingTab extends PluginSettingTab {
  plugin: ZenithAI;
  private root: Root | null = null;

  constructor(app: App, plugin: ZenithAI) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass('fo2k-view');

    if (!this.root) {
      this.root = createRoot(containerEl);
    }

    this.root.render(
      <React.StrictMode>
          <SettingsTabContent plugin={this.plugin} />
      </React.StrictMode>
    );
  }

  hide(): void {
    logMessage("hide");
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
    this.containerEl.removeClass('fo2k-view');
  }
}

