import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { generateDocumentParserMarkdownCase } from "../helpers/markdown-generators";
import { parseDocumentWithPublicApi } from "../helpers/public-api-loaders";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function assertValidTree(
  node: Record<string, unknown>,
  sourceByteLength: number,
  parentStart: number,
  parentEnd: number
): void {
  const startByte = node.startByte;
  const endByte = node.endByte;
  assert.equal(typeof startByte, "number");
  assert.equal(typeof endByte, "number");
  assert.ok(startByte >= parentStart);
  assert.ok(endByte <= parentEnd);
  assert.ok(startByte <= endByte);

  const children = node.children;
  assert.ok(Array.isArray(children));

  let previousEnd = startByte;
  for (const child of children) {
    assert.ok(isRecord(child));
    assert.ok((child.startByte as number) >= previousEnd);
    previousEnd = child.endByte as number;
    assertValidTree(child, sourceByteLength, startByte, endByte);
  }

  assert.ok(endByte <= sourceByteLength);
}

describe("Patch engine document parser invariants", () => {
  it("[TASK 2.3] [INVARIANT] parsing arbitrary markdown always yields a byte-valid structural tree", async () => {
    /**
     * Input generation:
     * - random valid markdown structures spanning empty files, no headings, single headings,
     *   H1->H4 jumps, duplicate headings, and list/blockquote-contained code blocks
     * - random unicode labels and paragraphs with emoji, CJK, accents, and punctuation
     * - adversarial empty-file case retained in the generator rotation
     */
    const encoder = new TextEncoder();

    for (let seed = 0; seed < 30; seed += 1) {
      const source = generateDocumentParserMarkdownCase(seed);
      const parsed = await parseDocumentWithPublicApi(
        source,
        `generated/document-${seed}.md`
      );

      const root = parsed.root;
      assert.ok(isRecord(root), "DocumentParser must return a ParsedDocument root.");
      const sourceByteLength = encoder.encode(source).length;
      assert.equal(root.startByte, 0);
      assert.equal(root.endByte, sourceByteLength);
      assertValidTree(root, sourceByteLength, 0, sourceByteLength);
    }
  });
});
