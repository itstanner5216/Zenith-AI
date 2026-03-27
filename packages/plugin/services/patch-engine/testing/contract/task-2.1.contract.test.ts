import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DeterministicRandom } from "../helpers/deterministic-random";
import {
  createParserManager,
  loadPatchEngineModule,
} from "../helpers/public-api-loaders";

describe("Patch engine parser contracts", () => {
  it("[TASK 2.1] [CONTRACT] parser manager exposes deterministic markdown parsing for repeated inputs", async () => {
    /**
     * Input generation:
     * - random unicode markdown bodies with emoji, CJK, punctuation, and mixed line breaks
     * - adversarial empty document and single-heading document cases injected into the corpus
     * - repeated parses through the public parser manager API to prove determinism
     */
    const module = await loadPatchEngineModule("../../parsers/parser-manager.ts");
    const parserManager = createParserManager(module);
    await parserManager.initialize();

    try {
      const supportedGrammars = new Set(parserManager.getSupportedGrammars());
      assert.ok(
        supportedGrammars.has("markdown"),
        'ParserManager must report "markdown" as a supported grammar.'
      );

      for (let seed = 0; seed < 24; seed += 1) {
        const rng = new DeterministicRandom(seed + 2100);
        const source =
          seed === 0
            ? ""
            : seed === 1
              ? `# ${rng.unicodeString(4, 12)}`
              : `${rng.unicodeString(8, 18)}\n\n## ${rng.unicodeString(
                  4,
                  12
                )}\n\n${rng.unicodeString(8, 24)}`;

        const first = await parserManager.parseMarkdown(source);
        const second = await parserManager.parseMarkdown(source);
        const viaLanguage = await parserManager.parseLanguage("markdown", source);

        assert.deepEqual(second, first);
        assert.deepEqual(viaLanguage, first);
      }
    } finally {
      parserManager.dispose();
    }
  });
});
