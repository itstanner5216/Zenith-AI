/**
 * Type-level and runtime tests for the EditDiagnostic discriminated union.
 *
 * Compile-time safety: invalid code+field combinations are structurally
 * impossible — e.g. you cannot attach `editorHash` to a "PATH_UNSAFE"
 * diagnostic. The TypeScript compiler enforces this; no runtime test needed.
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import type { EditDiagnostic, DiagnosticCode } from "../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal diagnostic (only required base fields). */
function minimalDiagnostic<T extends EditDiagnostic>(d: T): T {
  return d;
}

/** Round-trip a value through JSON serialisation. */
function jsonRoundTrip<T>(value: T): unknown {
  return JSON.parse(JSON.stringify(value));
}

// ---------------------------------------------------------------------------
// Construction — every variant must compile and round-trip cleanly
// ---------------------------------------------------------------------------

describe("EditDiagnostic construction", () => {
  it("constructs NEVER_READ with only base fields", () => {
    const d = minimalDiagnostic({
      code: "NEVER_READ" as const,
      shortMessage: "File was never read",
      hints: ["Read the file first"],
    });
    assert.equal(d.code, "NEVER_READ");
    assert.deepStrictEqual(jsonRoundTrip(d), d);
  });

  it("constructs FILE_CHANGED with optional base fields", () => {
    const d = minimalDiagnostic({
      code: "FILE_CHANGED" as const,
      shortMessage: "File changed since read",
      hints: ["Re-read"],
      retryHint: "Re-read the file and retry",
      currentOutline: {
        path: "foo.md",
        sourceFileHash16: "abcdef0123456789",
        origin: "vault" as const,
        outline: [],
      },
    });
    assert.equal(d.code, "FILE_CHANGED");
    assert.ok(d.currentOutline);
    assert.deepStrictEqual(jsonRoundTrip(d), d);
  });

  it("constructs EDITOR_DIRTY with code-specific fields", () => {
    const d = minimalDiagnostic({
      code: "EDITOR_DIRTY" as const,
      shortMessage: "Editor buffer is dirty",
      hints: ["Save or discard editor changes"],
      editorHash: "aaaa1111",
      vaultHash: "bbbb2222",
    });
    assert.equal(d.code, "EDITOR_DIRTY");
    assert.equal(d.editorHash, "aaaa1111");
    assert.equal(d.vaultHash, "bbbb2222");
    assert.deepStrictEqual(jsonRoundTrip(d), d);
  });

  it("constructs HASH_NOT_FOUND", () => {
    const d = minimalDiagnostic({
      code: "HASH_NOT_FOUND" as const,
      shortMessage: "Hash not found",
      hints: [],
    });
    assert.equal(d.code, "HASH_NOT_FOUND");
    assert.deepStrictEqual(jsonRoundTrip(d), d);
  });

  it("constructs AMBIGUOUS_TARGET with candidates", () => {
    const d = minimalDiagnostic({
      code: "AMBIGUOUS_TARGET" as const,
      shortMessage: "Ambiguous target",
      hints: ["Narrow the target"],
      candidates: [
        { hash: "aabb", type: "section", label: "Intro", excerpt: "..." },
      ],
    });
    assert.equal(d.code, "AMBIGUOUS_TARGET");
    assert.equal(d.candidates?.length, 1);
    assert.deepStrictEqual(jsonRoundTrip(d), d);
  });

  it("constructs SYMBOL_TARGET_UNAVAILABLE with code-specific fields", () => {
    const d = minimalDiagnostic({
      code: "SYMBOL_TARGET_UNAVAILABLE" as const,
      shortMessage: "Symbol targeting unavailable",
      hints: ["Target the parent code block instead"],
      reason: "language_unsupported" as const,
      blockHash: "cc33dd44",
    });
    assert.equal(d.code, "SYMBOL_TARGET_UNAVAILABLE");
    assert.equal(d.reason, "language_unsupported");
    assert.equal(d.blockHash, "cc33dd44");
    assert.deepStrictEqual(jsonRoundTrip(d), d);
  });

  it("constructs BUDGET_EXCEEDED", () => {
    const d = minimalDiagnostic({
      code: "BUDGET_EXCEEDED" as const,
      shortMessage: "Budget exceeded",
      hints: ["Reduce scope"],
    });
    assert.equal(d.code, "BUDGET_EXCEEDED");
    assert.deepStrictEqual(jsonRoundTrip(d), d);
  });

  it("constructs BOUNDARY_VIOLATION", () => {
    const d = minimalDiagnostic({
      code: "BOUNDARY_VIOLATION" as const,
      shortMessage: "Boundary violation",
      hints: [],
    });
    assert.equal(d.code, "BOUNDARY_VIOLATION");
    assert.deepStrictEqual(jsonRoundTrip(d), d);
  });

  it("constructs STRUCTURE_BROKEN", () => {
    const d = minimalDiagnostic({
      code: "STRUCTURE_BROKEN" as const,
      shortMessage: "Structure broken",
      hints: [],
    });
    assert.equal(d.code, "STRUCTURE_BROKEN");
    assert.deepStrictEqual(jsonRoundTrip(d), d);
  });

  it("constructs PATH_UNSAFE", () => {
    const d = minimalDiagnostic({
      code: "PATH_UNSAFE" as const,
      shortMessage: "Unsafe path",
      hints: [],
    });
    assert.equal(d.code, "PATH_UNSAFE");
    assert.deepStrictEqual(jsonRoundTrip(d), d);
  });

  it("constructs PATH_MISMATCH", () => {
    const d = minimalDiagnostic({
      code: "PATH_MISMATCH" as const,
      shortMessage: "Path mismatch",
      hints: [],
    });
    assert.equal(d.code, "PATH_MISMATCH");
    assert.deepStrictEqual(jsonRoundTrip(d), d);
  });

  it("constructs OVERLAPPING_EDITS", () => {
    const d = minimalDiagnostic({
      code: "OVERLAPPING_EDITS" as const,
      shortMessage: "Overlapping edits",
      hints: [],
    });
    assert.equal(d.code, "OVERLAPPING_EDITS");
    assert.deepStrictEqual(jsonRoundTrip(d), d);
  });

  it("constructs WRITE_VERIFY_FAILED with code-specific fields", () => {
    const d = minimalDiagnostic({
      code: "WRITE_VERIFY_FAILED" as const,
      shortMessage: "Write verify failed",
      hints: ["Retry the write"],
      intendedHash: "1111aaaa",
      actualHash: "2222bbbb",
    });
    assert.equal(d.code, "WRITE_VERIFY_FAILED");
    assert.equal(d.intendedHash, "1111aaaa");
    assert.equal(d.actualHash, "2222bbbb");
    assert.deepStrictEqual(jsonRoundTrip(d), d);
  });

  it("constructs RESTORE_FAILED with code-specific fields", () => {
    const d = minimalDiagnostic({
      code: "RESTORE_FAILED" as const,
      shortMessage: "Restore failed",
      hints: [],
      intendedHash: "3333cccc",
      actualHash: "4444dddd",
    });
    assert.equal(d.code, "RESTORE_FAILED");
    assert.equal(d.intendedHash, "3333cccc");
    assert.equal(d.actualHash, "4444dddd");
    assert.deepStrictEqual(jsonRoundTrip(d), d);
  });

  it("constructs LOCK_LOST", () => {
    const d = minimalDiagnostic({
      code: "LOCK_LOST" as const,
      shortMessage: "Lock lost",
      hints: [],
    });
    assert.equal(d.code, "LOCK_LOST");
    assert.deepStrictEqual(jsonRoundTrip(d), d);
  });
});

// ---------------------------------------------------------------------------
// Type narrowing — code-specific fields are accessible only via narrowing
// ---------------------------------------------------------------------------

describe("EditDiagnostic type narrowing", () => {
  it("narrows EDITOR_DIRTY to expose editorHash and vaultHash", () => {
    const d: EditDiagnostic = {
      code: "EDITOR_DIRTY",
      shortMessage: "dirty",
      hints: [],
      editorHash: "e1",
      vaultHash: "v1",
    };
    if (d.code === "EDITOR_DIRTY") {
      assert.equal(d.editorHash, "e1");
      assert.equal(d.vaultHash, "v1");
    } else {
      assert.fail("Expected EDITOR_DIRTY");
    }
  });

  it("narrows SYMBOL_TARGET_UNAVAILABLE to expose reason and blockHash", () => {
    const d: EditDiagnostic = {
      code: "SYMBOL_TARGET_UNAVAILABLE",
      shortMessage: "unavailable",
      hints: [],
      reason: "block_oversized",
      blockHash: "bh1",
    };
    if (d.code === "SYMBOL_TARGET_UNAVAILABLE") {
      assert.equal(d.reason, "block_oversized");
      assert.equal(d.blockHash, "bh1");
    } else {
      assert.fail("Expected SYMBOL_TARGET_UNAVAILABLE");
    }
  });

  it("narrows WRITE_VERIFY_FAILED to expose intendedHash and actualHash", () => {
    const d: EditDiagnostic = {
      code: "WRITE_VERIFY_FAILED",
      shortMessage: "verify failed",
      hints: [],
      intendedHash: "ih1",
      actualHash: "ah1",
    };
    if (d.code === "WRITE_VERIFY_FAILED") {
      assert.equal(d.intendedHash, "ih1");
      assert.equal(d.actualHash, "ah1");
    } else {
      assert.fail("Expected WRITE_VERIFY_FAILED");
    }
  });

  it("narrows RESTORE_FAILED to expose intendedHash and actualHash", () => {
    const d: EditDiagnostic = {
      code: "RESTORE_FAILED",
      shortMessage: "restore failed",
      hints: [],
      intendedHash: "ih2",
      actualHash: "ah2",
    };
    if (d.code === "RESTORE_FAILED") {
      assert.equal(d.intendedHash, "ih2");
      assert.equal(d.actualHash, "ah2");
    } else {
      assert.fail("Expected RESTORE_FAILED");
    }
  });
});

// ---------------------------------------------------------------------------
// DiagnosticCode derived type
// ---------------------------------------------------------------------------

describe("DiagnosticCode", () => {
  it("accepts all valid codes", () => {
    const codes: DiagnosticCode[] = [
      "NEVER_READ",
      "FILE_CHANGED",
      "EDITOR_DIRTY",
      "HASH_NOT_FOUND",
      "AMBIGUOUS_TARGET",
      "SYMBOL_TARGET_UNAVAILABLE",
      "BUDGET_EXCEEDED",
      "BOUNDARY_VIOLATION",
      "STRUCTURE_BROKEN",
      "PATH_UNSAFE",
      "PATH_MISMATCH",
      "OVERLAPPING_EDITS",
      "WRITE_VERIFY_FAILED",
      "RESTORE_FAILED",
      "LOCK_LOST",
    ];
    assert.equal(codes.length, 15);
  });
});

// ---------------------------------------------------------------------------
// Minimal contract — code + shortMessage + hints is always valid
// ---------------------------------------------------------------------------

describe("Minimal diagnostic contract", () => {
  it("accepts a diagnostic with only code, shortMessage, and hints", () => {
    const d: EditDiagnostic = {
      code: "PATH_UNSAFE",
      shortMessage: "Unsafe path",
      hints: ["Use a safe path"],
    };
    assert.equal(d.code, "PATH_UNSAFE");
    assert.equal(d.shortMessage, "Unsafe path");
    assert.deepStrictEqual(d.hints, ["Use a safe path"]);
    assert.equal(d.retryHint, undefined);
    assert.equal(d.currentOutline, undefined);
    assert.equal(d.candidates, undefined);
  });
});
