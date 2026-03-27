import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { SourceResolver } from "../../source-resolver";
import { DeterministicRandom } from "../helpers/deterministic-random";
import {
  createMockEditorBufferAdapter,
  createMockFileSystemAdapter,
} from "../helpers/host-adapter-mocks";

describe("Patch engine source resolution invariants", () => {
  it("[TASK 1.1] [INVARIANT] preview source resolution obeys the editor-vault truth table for all editor states", async () => {
    /**
     * Input generation:
     * - random unicode strings mixing ASCII, emoji, CJK, accents, and mixed newlines
     * - random editor state selection: unopened, clean-open, dirty-open
     * - adversarial empty and single-character cases injected by seed
     */
    for (let seed = 0; seed < 96; seed += 1) {
      const rng = new DeterministicRandom(seed + 11);
      const scenario = seed % 3;
      const vaultContent =
        seed % 8 === 0 ? "" : seed % 9 === 0 ? "x" : rng.unicodeString(1, 32);
      let editorContent =
        scenario === 2
          ? seed % 10 === 0
            ? ""
            : rng.unicodeString(1, 32)
          : vaultContent;
      if (scenario === 2 && editorContent === vaultContent) {
        editorContent = `${editorContent}!`;
      }

      const openFiles =
        scenario === 0 ? {} : { "generated/property.md": editorContent };
      const resolver = new SourceResolver(
        createMockFileSystemAdapter({ "generated/property.md": vaultContent }),
        createMockEditorBufferAdapter(openFiles)
      );

      const resolved = await resolver.resolve("generated/property.md");
      const writeSafety = await resolver.checkWriteSafety("generated/property.md");

      if (scenario === 0) {
        assert.equal(resolved.snapshot.content, vaultContent);
        assert.equal(resolved.snapshot.origin, "vault");
        assert.equal(resolved.snapshot.writable, true);
        assert.equal(resolved.editorDirty, false);
        assert.equal(writeSafety, null);
        continue;
      }

      if (scenario === 1) {
        assert.equal(resolved.snapshot.content, vaultContent);
        assert.equal(resolved.snapshot.origin, "vault");
        assert.equal(resolved.snapshot.writable, true);
        assert.equal(resolved.editorDirty, false);
        assert.equal(writeSafety, null);
        continue;
      }

      assert.equal(resolved.snapshot.content, editorContent);
      assert.equal(resolved.snapshot.origin, "editor");
      assert.equal(resolved.snapshot.writable, false);
      assert.equal(resolved.editorDirty, true);
      assert.notEqual(writeSafety, null);
      assert.match(writeSafety!.editorHash, /^[0-9a-f]{16}$/);
      assert.match(writeSafety!.vaultHash, /^[0-9a-f]{16}$/);
      if (editorContent !== vaultContent) {
        assert.notEqual(writeSafety!.editorHash, writeSafety!.vaultHash);
      }
    }
  });
});
