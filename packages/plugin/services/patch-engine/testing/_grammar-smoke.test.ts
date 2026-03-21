import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseCst, type Grammar } from "../rust-tree-sitter-runtime";

describe("all grammar smoke tests", () => {
  const tests: [Grammar, string, string][] = [
    ["javascript", "function hello() { return 42; }", "program"],
    ["python", "def hello():\n    return 42\n", "module"],
    ["bash", "#!/bin/bash\necho hello\n", "program"],
    ["css", "body { color: red; }", "stylesheet"],
    ["go", "package main\nfunc main() {}", "source_file"],
    ["yaml", "key: value\n", "stream"],
    ["sql", "SELECT id FROM users;", "program"],
    ["tsx", "const x = () => <div/>;", "program"],
  ];

  for (const [lang, src, expectedRoot] of tests) {
    it(`parses ${lang}`, async () => {
      const root = await parseCst(lang, src);
      assert.equal(root.type, expectedRoot, `${lang} root should be ${expectedRoot}`);
      assert.ok(root.endByte > 0, `${lang} endByte should be > 0`);
      assert.ok(root.children.length > 0, `${lang} should have children`);
    });
  }
});
