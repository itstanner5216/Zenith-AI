import { DeterministicRandom } from "./deterministic-random";

export interface GeneratedFallbackMarkdownCase {
  source: string;
  insideFenceHeadings: string[];
}

function randomLabel(rng: DeterministicRandom): string {
  return rng.unicodeString(4, 16).replace(/\s+/g, " ").trim() || "fallback";
}

export function generateFallbackMarkdownCase(
  seed: number
): GeneratedFallbackMarkdownCase {
  const rng = new DeterministicRandom(seed);
  const lines: string[] = [];
  const insideFenceHeadings: string[] = [];

  if (seed % 7 === 0) {
    return {
      source: "",
      insideFenceHeadings,
    };
  }

  lines.push(`# ${randomLabel(rng)}`);
  lines.push("");
  lines.push(rng.unicodeString(8, 24));
  lines.push("");

  const fencePrefix = rng.pick(["", "> ", "- ", "  - ", "> - "]);
  const fenceMarker = rng.pick(["```", "~~~"]);
  const fenceLanguage = rng.bool(0.5) ? "" : rng.pick(["ts", "js", "python"]);
  lines.push(`${fencePrefix}${fenceMarker}${fenceLanguage}`);
  const fakeHeadingCount = rng.int(1, 3);
  for (let index = 0; index < fakeHeadingCount; index += 1) {
    const fakeHeading = `${"#".repeat(rng.int(1, 4))} ${randomLabel(rng)}`;
    insideFenceHeadings.push(fakeHeading);
    lines.push(`${fencePrefix}${fakeHeading}`);
  }
  lines.push(`${fencePrefix}${rng.unicodeString(6, 18)}`);
  lines.push(`${fencePrefix}${fenceMarker}`);
  lines.push("");
  lines.push(`## ${randomLabel(rng)}`);
  lines.push("");
  lines.push(rng.unicodeString(10, 28));

  return {
    source: lines.join("\n"),
    insideFenceHeadings,
  };
}

export function generateDocumentParserMarkdownCase(seed: number): string {
  const rng = new DeterministicRandom(seed);
  const variant = seed % 6;

  if (variant === 0) {
    return "";
  }

  if (variant === 1) {
    return [
      rng.unicodeString(10, 30),
      "",
      rng.unicodeString(12, 24),
      "",
      "> blockquote paragraph",
      ">",
      "> ```ts",
      "> const value = 1;",
      "> ```",
    ].join("\n");
  }

  if (variant === 2) {
    return [
      `# ${randomLabel(rng)}`,
      "",
      rng.unicodeString(10, 24),
      "",
      "```python",
      "def alpha():",
      "    return 1",
      "```",
    ].join("\n");
  }

  if (variant === 3) {
    const duplicate = randomLabel(rng);
    return [
      `# ${randomLabel(rng)}`,
      "",
      `#### ${randomLabel(rng)}`,
      "",
      `## ${duplicate}`,
      "",
      rng.unicodeString(8, 20),
      "",
      `## ${duplicate}`,
      "",
      rng.unicodeString(8, 20),
    ].join("\n");
  }

  if (variant === 4) {
    return [
      "---",
      "title: parser-case",
      "---",
      "",
      `# ${randomLabel(rng)}`,
      "",
      "- list item",
      "  ```js",
      "  function insideList() {",
      "    return true;",
      "  }",
      "  ```",
      "",
      rng.unicodeString(10, 18),
    ].join("\n");
  }

  return [
    `# ${randomLabel(rng)}`,
    "",
    rng.unicodeString(8, 18),
    "",
    "> quote",
    ">",
    "> ```go",
    "> func sample() {}",
    "> ```",
    "",
    rng.unicodeString(10, 20),
  ].join("\n");
}
