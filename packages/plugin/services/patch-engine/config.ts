/**
 * Patch Engine feature flags and shadow-mode controls.
 *
 * These flags govern the rollout of the Zenith Patch Engine.
 * The engine ships in preview-only shadow mode by default:
 * previews enabled, writes disabled.
 */

/** Feature flags controlling patch engine behavior. */
export interface PatchEngineFlags {
  /** When true, the patch engine preview pipeline is active. */
  enablePatchEnginePreview: boolean;
  /** When true, the patch engine may write edits to vault files. */
  enablePatchEngineWrites: boolean;
  /** When true, the regex-based fallback scanner is used when tree-sitter parse fails. */
  enableFallbackScanner: boolean;
  /** When true, incremental parsing is used instead of full reparse. Scaffolded but not production-ready. */
  enableIncrementalParsing: boolean;
}

/** Default flag values for initial shadow-mode rollout. */
export const DEFAULT_PATCH_ENGINE_FLAGS: Readonly<PatchEngineFlags> = {
  enablePatchEnginePreview: true,
  enablePatchEngineWrites: false,
  enableFallbackScanner: true,
  enableIncrementalParsing: false,
};

/**
 * Returns a mutable copy of the default flags, optionally merged with overrides.
 *
 * @param overrides - Partial flag overrides to apply on top of defaults.
 * @returns A new `PatchEngineFlags` object.
 */
export function createPatchEngineFlags(
  overrides?: Partial<PatchEngineFlags>
): PatchEngineFlags {
  return { ...DEFAULT_PATCH_ENGINE_FLAGS, ...overrides };
}
