export interface ParserManagerLike {
  initialize(): Promise<void>;
  parseMarkdown(source: string): Promise<unknown>;
  parseLanguage(grammar: string, source: string): Promise<unknown>;
  getSupportedGrammars(): readonly string[];
  dispose(): void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function loadPatchEngineModule(
  relativePathFromHelpers: string
): Promise<Record<string, unknown>> {
  try {
    return (await import(
      new URL(relativePathFromHelpers, import.meta.url).href
    )) as Record<string, unknown>;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Unable to load patch-engine public module "${relativePathFromHelpers}": ${message}`
    );
  }
}

export function createParserManager(
  module: Record<string, unknown>
): ParserManagerLike {
  const Constructor = module.ParserManager;
  if (typeof Constructor !== "function") {
    throw new Error(
      'Expected parser manager module to export a "ParserManager" constructor.'
    );
  }

  return new (Constructor as new () => ParserManagerLike)();
}

export function resolveFallbackScanner(
  module: Record<string, unknown>
): (source: string) => unknown {
  const namedScannerExports = [
    "scanMarkdownFallback",
    "scanFallbackMarkdown",
    "scanMarkdown",
  ];

  for (const exportName of namedScannerExports) {
    const candidate = module[exportName];
    if (typeof candidate === "function") {
      return candidate as (source: string) => unknown;
    }
  }

  const ScannerConstructor = module.MarkdownFallbackScanner;
  if (typeof ScannerConstructor === "function") {
    const instance = new (ScannerConstructor as new () => Record<string, unknown>)();
    for (const methodName of ["scan", "parse"]) {
      const method = instance[methodName];
      if (typeof method === "function") {
        return (source: string): unknown =>
          (method as (this: unknown, text: string) => unknown).call(
            instance,
            source
          );
      }
    }
  }

  throw new Error(
    "Expected markdown fallback scanner public API to expose a callable scanner."
  );
}

export function getFallbackNodes(output: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(output)) {
    return output.filter(isRecord);
  }
  if (isRecord(output)) {
    const candidates = [output.nodes, output.outline, output.result];
    for (const candidate of candidates) {
      if (Array.isArray(candidate)) {
        return candidate.filter(isRecord);
      }
    }
  }
  throw new Error("Fallback scanner did not return a node collection.");
}

export async function parseDocumentWithPublicApi(
  source: string,
  path: string
): Promise<Record<string, unknown>> {
  const parserModule = await loadPatchEngineModule("../../parsers/document-parser.ts");
  const parserManagerModule = await loadPatchEngineModule(
    "../../parsers/parser-manager.ts"
  );
  const parserManager = createParserManager(parserManagerModule);
  await parserManager.initialize();

  try {
    const Constructor = parserModule.DocumentParser;
    if (typeof Constructor !== "function") {
      throw new Error(
        'Expected document parser module to export a "DocumentParser" constructor.'
      );
    }

    const parser =
      Constructor.length === 0
        ? new (Constructor as new () => Record<string, unknown>)()
        : new (Constructor as new (manager: ParserManagerLike) => Record<string, unknown>)(
            parserManager
          );

    const methodNames = ["parseDocument", "parse"];
    const invocationPlans: Array<unknown[]> = [
      [{ path, source, origin: "vault" }],
      [path, source, "vault"],
      [path, source],
      [source, path],
      [source],
    ];

    for (const methodName of methodNames) {
      const method = parser[methodName];
      if (typeof method !== "function") {
        continue;
      }

      for (const invocationPlan of invocationPlans) {
        try {
          const result = await (method as (...args: unknown[]) => Promise<unknown>).apply(
            parser,
            invocationPlan
          );
          if (isRecord(result)) {
            return result;
          }
        } catch {
          // Try the next supported public parse signature.
        }
      }
    }

    throw new Error(
      "DocumentParser did not accept any supported public parse signature."
    );
  } finally {
    parserManager.dispose();
  }
}
