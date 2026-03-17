/**
 * Byte-canonical text representation for the Zenith Patch Engine.
 *
 * Placeholder — full implementation is Task 1.2.
 * This file exists so that type imports in types.ts resolve.
 */

/** Byte-canonical text wrapper using Uint8Array internally. */
export class ByteText {
  static fromString(_text: string): ByteText {
    throw new Error("Depends on Task 1.2");
  }

  static fromBytes(_bytes: Uint8Array): ByteText {
    throw new Error("Depends on Task 1.2");
  }

  toBytes(): Uint8Array {
    throw new Error("Depends on Task 1.2");
  }

  toString(): string {
    throw new Error("Depends on Task 1.2");
  }

  sliceBytes(_startByte: number, _endByte: number): Uint8Array {
    throw new Error("Depends on Task 1.2");
  }

  detectNewlineStyle(): "\n" | "\r\n" | "mixed" {
    throw new Error("Depends on Task 1.2");
  }
}
