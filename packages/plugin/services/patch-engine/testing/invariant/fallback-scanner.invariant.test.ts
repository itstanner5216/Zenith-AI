import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { generateFallbackMarkdownCase } from "../helpers/markdown-generators";
import {
  getFallbackNodes,
  loadPatchEngineModule,
  resolveFallbackScanner,
} from "../helpers/public-api-loaders";

describe("Patch engine fallback scanner invariants", () => {
  it("[TASK 2.2] [INVARIANT] headings inside fenced code are never promoted to structural headings", async () => {
    /**
     * Input generation:
     * - random markdown with nested code fences inside plain, list, and blockquote prefixes
     * - random fake headings injected only inside fences, plus real headings outside fences
     * - adversarial empty document case included to force scanner edge handling
     */
    const module = await loadPatchEngineModule(
      "../../parsers/markdown-fallback-scanner.ts"
    );
    const scan = resolveFallbackScanner(module);

    for (let seed = 0; seed < 36; seed += 1) {
      const generated = generateFallbackMarkdownCase(seed);
      const nodes = getFallbackNodes(await scan(generated.source));
      const promotedHeadingLabels = new Set(
        nodes
          .filter((node) => node.type === "heading")
          .map((node) => String(node.label ?? ""))
      );

      for (const fakeHeading of generated.insideFenceHeadings) {
        const fakeLabel = fakeHeading.replace(/^#+\s*/, "");
        assert.equal(
          promotedHeadingLabels.has(fakeLabel),
          false,
          `fallback scanner promoted an in-fence heading: ${fakeHeading}`
        );
      }
    }
  });
});
