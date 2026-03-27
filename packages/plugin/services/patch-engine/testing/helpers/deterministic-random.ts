const ASCII_FRAGMENTS = [
  "a",
  "b",
  "c",
  "x",
  "y",
  "z",
  "0",
  "1",
  "2",
  " ",
  "-",
  "_",
  ".",
  ",",
  ":",
  ";",
  "/",
  "#",
  ">",
  "|",
];

const UNICODE_FRAGMENTS = [
  "😀",
  "🚀",
  "🧪",
  "漢",
  "字",
  "仮",
  "名",
  "測",
  "試",
  "é",
  "ñ",
  "ü",
  "ç",
  "ø",
  "λ",
  "Ω",
  "🌌",
];

const NEWLINE_FRAGMENTS = ["\n", "\r\n"];

export class DeterministicRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    let nextState = this.state + 0x6d2b79f5;
    nextState = Math.imul(nextState ^ (nextState >>> 15), nextState | 1);
    nextState ^= nextState + Math.imul(nextState ^ (nextState >>> 7), nextState | 61);
    this.state = nextState >>> 0;
    return ((nextState ^ (nextState >>> 14)) >>> 0) / 4294967296;
  }

  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  bool(probability = 0.5): boolean {
    return this.next() < probability;
  }

  pick<T>(values: readonly T[]): T {
    return values[this.int(0, values.length - 1)];
  }

  unicodeString(minLength: number, maxLength: number): string {
    const length = this.int(minLength, maxLength);
    const fragments = [...ASCII_FRAGMENTS, ...UNICODE_FRAGMENTS];
    let value = "";
    for (let index = 0; index < length; index += 1) {
      if (this.bool(0.1)) {
        value += this.pick(NEWLINE_FRAGMENTS);
        continue;
      }
      value += this.pick(fragments);
    }
    return value;
  }
}
