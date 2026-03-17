import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { parseCst } from "../rust-tree-sitter-runtime";

describe("rust tree-sitter wasm viability spike", () => {
  it("can parse JSON and report UTF-8 byte-oriented root offsets", async () => {
    const source = '{"k":"é🎉"}';
    const root = await parseCst("json", source);
    const utf8Len = Buffer.byteLength(source, "utf8");

    assert.equal(root.startByte, 0);
    assert.equal(root.endByte, utf8Len);
  });

  it("can parse TypeScript and report UTF-8 byte-oriented root offsets", async () => {
    const source = 'const x = "é🎉";';
    const root = await parseCst("typescript", source);
    const utf8Len = Buffer.byteLength(source, "utf8");

    assert.equal(root.startByte, 0);
    assert.equal(root.endByte, utf8Len);
  });

  it("can parse Markdown and report UTF-8 byte-oriented root offsets", async () => {
    const source = "# Héading 🎉\n\nRésumé 日本語\n";
    const root = await parseCst("markdown", source);
    const utf8Len = Buffer.byteLength(source, "utf8");

    assert.equal(root.startByte, 0);
    assert.equal(root.endByte, utf8Len);
  });
});
