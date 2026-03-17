/**
 * Tests for ByteText — the byte-canonical text representation.
 *
 * Verifies UTF-8 encoding/decoding, byte-correct slicing, newline detection,
 * and bounded excerpt decoding. Uses node:test (patch engine convention).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ByteText } from "../utils/byte-text";

// ---------------------------------------------------------------------------
// Construction and round-trip
// ---------------------------------------------------------------------------

describe("ByteText", () => {
  describe("fromString / toString round-trip", () => {
    it("preserves ASCII content", () => {
      const bt = ByteText.fromString("hello world");
      assert.equal(bt.toString(), "hello world");
    });

    it("preserves multi-byte UTF-8 content", () => {
      const text = "日本語テスト 🎉 café";
      const bt = ByteText.fromString(text);
      assert.equal(bt.toString(), text);
    });

    it("preserves empty string", () => {
      const bt = ByteText.fromString("");
      assert.equal(bt.toString(), "");
      assert.equal(bt.byteLength, 0);
    });
  });

  describe("fromBytes / toBytes round-trip", () => {
    it("copies input bytes (no aliasing)", () => {
      const original = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
      const bt = ByteText.fromBytes(original);
      // Mutate original — should not affect ByteText
      original[0] = 0;
      assert.equal(bt.toString(), "Hello");
    });

    it("toBytes returns a copy (no aliasing)", () => {
      const bt = ByteText.fromString("test");
      const bytes1 = bt.toBytes();
      const bytes2 = bt.toBytes();
      bytes1[0] = 0;
      assert.notDeepEqual(bytes1, bytes2);
    });
  });

  // ---------------------------------------------------------------------------
  // byteLength
  // ---------------------------------------------------------------------------

  describe("byteLength", () => {
    it("reports correct byte length for ASCII", () => {
      assert.equal(ByteText.fromString("abc").byteLength, 3);
    });

    it("reports correct byte length for multi-byte characters", () => {
      // "日" is 3 bytes in UTF-8
      assert.equal(ByteText.fromString("日").byteLength, 3);
      // "🎉" is 4 bytes in UTF-8
      assert.equal(ByteText.fromString("🎉").byteLength, 4);
      // "café" is 5 bytes (c=1, a=1, f=1, é=2)
      assert.equal(ByteText.fromString("café").byteLength, 5);
    });
  });

  // ---------------------------------------------------------------------------
  // sliceBytes
  // ---------------------------------------------------------------------------

  describe("sliceBytes", () => {
    it("slices ASCII range correctly", () => {
      const bt = ByteText.fromString("hello world");
      const slice = bt.sliceBytes(6, 11);
      const decoded = new TextDecoder().decode(slice);
      assert.equal(decoded, "world");
    });

    it("slices multi-byte character boundaries correctly", () => {
      // "日本" = 6 bytes (3 + 3)
      const bt = ByteText.fromString("日本");
      const first = bt.sliceBytes(0, 3);
      assert.equal(new TextDecoder().decode(first), "日");
      const second = bt.sliceBytes(3, 6);
      assert.equal(new TextDecoder().decode(second), "本");
    });

    it("returns empty array for zero-width range", () => {
      const bt = ByteText.fromString("test");
      const slice = bt.sliceBytes(2, 2);
      assert.equal(slice.byteLength, 0);
    });

    it("throws RangeError for negative start", () => {
      const bt = ByteText.fromString("test");
      assert.throws(() => bt.sliceBytes(-1, 2), RangeError);
    });

    it("throws RangeError for end beyond byte length", () => {
      const bt = ByteText.fromString("test");
      assert.throws(() => bt.sliceBytes(0, 100), RangeError);
    });

    it("throws RangeError for inverted range", () => {
      const bt = ByteText.fromString("test");
      assert.throws(() => bt.sliceBytes(3, 1), RangeError);
    });
  });

  // ---------------------------------------------------------------------------
  // detectNewlineStyle
  // ---------------------------------------------------------------------------

  describe("detectNewlineStyle", () => {
    it("detects LF-only", () => {
      assert.equal(ByteText.fromString("line1\nline2\nline3").detectNewlineStyle(), "\n");
    });

    it("detects CRLF-only", () => {
      assert.equal(ByteText.fromString("line1\r\nline2\r\nline3").detectNewlineStyle(), "\r\n");
    });

    it("detects mixed newlines", () => {
      assert.equal(ByteText.fromString("line1\nline2\r\nline3").detectNewlineStyle(), "mixed");
    });

    it("defaults to LF for no newlines", () => {
      assert.equal(ByteText.fromString("no newlines here").detectNewlineStyle(), "\n");
    });

    it("defaults to LF for empty content", () => {
      assert.equal(ByteText.fromString("").detectNewlineStyle(), "\n");
    });
  });

  // ---------------------------------------------------------------------------
  // decodeExcerpt
  // ---------------------------------------------------------------------------

  describe("decodeExcerpt", () => {
    it("decodes a bounded excerpt", () => {
      const bt = ByteText.fromString("hello world");
      assert.equal(bt.decodeExcerpt(0, 5), "hello");
    });

    it("clamps start to zero", () => {
      const bt = ByteText.fromString("hello");
      const result = bt.decodeExcerpt(-10, 5);
      assert.equal(result, "hello");
    });

    it("clamps end to byte length", () => {
      const bt = ByteText.fromString("hi");
      const result = bt.decodeExcerpt(0, 100);
      assert.equal(result, "hi");
    });

    it("handles mid-character truncation gracefully", () => {
      // "日" is 3 bytes in UTF-8. Requesting only 2 bytes truncates mid-character.
      // TextDecoder with fatal:false replaces the incomplete sequence with U+FFFD.
      const bt = ByteText.fromString("日");
      const result = bt.decodeExcerpt(0, 2);
      assert.equal(result, "\uFFFD");
    });

    it("preserves complete characters before truncation point", () => {
      // "ab日" = 5 bytes (a=1, b=1, 日=3). Requesting 4 bytes gets "ab" + partial "日"
      const bt = ByteText.fromString("ab日");
      const result = bt.decodeExcerpt(0, 4);
      assert.equal(result, "ab\uFFFD");
    });
  });

  // ---------------------------------------------------------------------------
  // decodeRange
  // ---------------------------------------------------------------------------

  describe("decodeRange", () => {
    it("decodes a specific byte range", () => {
      const bt = ByteText.fromString("abcdef");
      assert.equal(bt.decodeRange(2, 5), "cde");
    });

    it("decodes multi-byte range", () => {
      const bt = ByteText.fromString("abc日本def");
      // "abc" = 3 bytes, "日" = 3 bytes, "本" = 3 bytes, "def" = 3 bytes
      assert.equal(bt.decodeRange(3, 9), "日本");
    });
  });
});
