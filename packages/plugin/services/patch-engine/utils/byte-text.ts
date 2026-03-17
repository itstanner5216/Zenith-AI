/**
 * Byte-canonical text representation for the Zenith Patch Engine.
 *
 * All structural coordinates in the engine use UTF-8 byte offsets.
 * This class wraps a Uint8Array (not Buffer) for platform independence
 * and provides byte-correct slicing, excerpt decoding, and newline detection.
 */

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: false });

/**
 * Byte-canonical text wrapper using Uint8Array internally.
 *
 * Immutable once constructed — all mutation returns a new instance.
 * Coordinates are always UTF-8 byte offsets, matching tree-sitter conventions.
 */
export class ByteText {
  /** Internal UTF-8 byte storage. */
  private readonly _bytes: Uint8Array;
  /** Lazily cached string representation. */
  private _cachedString: string | null = null;

  private constructor(bytes: Uint8Array) {
    this._bytes = bytes;
  }

  /**
   * Create a ByteText from a JavaScript string.
   * Encodes to UTF-8 bytes internally.
   */
  static fromString(text: string): ByteText {
    const instance = new ByteText(encoder.encode(text));
    // Cache the original string to avoid re-decoding
    instance._cachedString = text;
    return instance;
  }

  /**
   * Create a ByteText from raw UTF-8 bytes.
   * The provided array is copied — the caller can safely mutate the original.
   */
  static fromBytes(bytes: Uint8Array): ByteText {
    return new ByteText(bytes.slice());
  }

  /** Return a copy of the internal UTF-8 bytes. */
  toBytes(): Uint8Array {
    return this._bytes.slice();
  }

  /** Decode the internal bytes to a JavaScript string. */
  toString(): string {
    if (this._cachedString === null) {
      this._cachedString = decoder.decode(this._bytes);
    }
    return this._cachedString;
  }

  /** Total byte length of the content. */
  get byteLength(): number {
    return this._bytes.byteLength;
  }

  /**
   * Slice a byte range from the content.
   *
   * @param startByte - Inclusive start byte offset.
   * @param endByte - Exclusive end byte offset.
   * @returns A new Uint8Array containing the sliced bytes.
   * @throws RangeError if offsets are out of bounds or inverted.
   */
  sliceBytes(startByte: number, endByte: number): Uint8Array {
    if (startByte < 0 || endByte > this._bytes.byteLength || startByte > endByte) {
      throw new RangeError(
        `Invalid byte range [${startByte}, ${endByte}) for content of ${this._bytes.byteLength} bytes`
      );
    }
    return this._bytes.slice(startByte, endByte);
  }

  /**
   * Detect the dominant newline style in the content.
   *
   * @returns `"\n"` for LF-only, `"\r\n"` for CRLF-only, or `"mixed"` if both are present.
   */
  detectNewlineStyle(): "\n" | "\r\n" | "mixed" {
    const bytes = this._bytes;
    let lfCount = 0;
    let crlfCount = 0;

    for (let i = 0; i < bytes.byteLength; i++) {
      if (bytes[i] === 0x0d /* \r */) {
        if (i + 1 < bytes.byteLength && bytes[i + 1] === 0x0a /* \n */) {
          crlfCount++;
          i++; // skip the \n after \r
        }
        // bare \r without \n — treat as LF for counting purposes
      } else if (bytes[i] === 0x0a /* \n */) {
        lfCount++;
      }
    }

    if (crlfCount > 0 && lfCount > 0) {
      return "mixed";
    }
    if (crlfCount > 0) {
      return "\r\n";
    }
    return "\n";
  }

  /**
   * Decode a bounded excerpt from a byte range.
   *
   * Clamps the range to `[startByte, startByte + maxBytes)` and decodes
   * to a UTF-8 string. If the clamped range ends mid-character, the
   * decoder replaces the trailing partial sequence.
   *
   * @param startByte - Inclusive start byte offset.
   * @param maxBytes - Maximum number of bytes to decode.
   * @returns The decoded excerpt string.
   */
  decodeExcerpt(startByte: number, maxBytes: number): string {
    const clampedStart = Math.max(0, Math.min(startByte, this._bytes.byteLength));
    const clampedEnd = Math.min(clampedStart + maxBytes, this._bytes.byteLength);
    const slice = this._bytes.slice(clampedStart, clampedEnd);
    return decoder.decode(slice);
  }

  /**
   * Decode a specific byte range to a string.
   *
   * @param startByte - Inclusive start byte offset.
   * @param endByte - Exclusive end byte offset.
   * @returns The decoded string for the given byte range.
   */
  decodeRange(startByte: number, endByte: number): string {
    return decoder.decode(this.sliceBytes(startByte, endByte));
  }
}
