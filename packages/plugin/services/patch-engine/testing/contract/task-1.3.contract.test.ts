import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { DeterministicRandom } from "../helpers/deterministic-random";
import { generateTask13ContractSource } from "../helpers/generate-task-1.3-contract-source";

const execFileAsync = promisify(execFile);
const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

describe("Patch engine type contracts", () => {
  it("[TASK 1.3] [CONTRACT] public engine result types expose freshness and idempotency fields from the plan", async () => {
    /**
     * Input generation:
     * - random hashes, reasons, idempotency keys, byte sizes, and threshold values
     * - adversarial short paths and empty reasons folded into the generated typecheck program
     * - runtime contract check performed by compiling a public-API-only TypeScript specimen
     */
    const rng = new DeterministicRandom(13013);
    const tempRoot = await mkdtemp(
      path.join(currentDirectory, "../helpers/.task-1.3-")
    );
    const contractFile = path.join(tempRoot, "task-1.3-contract-check.ts");

    try {
      const source = generateTask13ContractSource({
        path: `generated/${rng.unicodeString(3, 8).replace(/[^\w-]/g, "") || "p"}.md`,
        sourceHash16: "0123456789abcdef",
        currentHash16: "fedcba9876543210",
        reason: rng.unicodeString(0, 24),
        idempotencyKey: `idem-${rng.unicodeString(4, 10).replace(/[^\w-]/g, "") || "k"}`,
        fileSizeBytes: rng.int(0, 4096),
        threshold: Number((rng.int(1, 95) / 100).toFixed(2)),
      });

      await writeFile(contractFile, source, "utf8");

      const tscPath = path.resolve(
        currentDirectory,
        "../../../../../../node_modules/typescript/lib/tsc.js"
      );

      try {
        await execFileAsync(
          process.execPath,
          [
            tscPath,
            "--noEmit",
            "--pretty",
            "false",
            "--strict",
            "--target",
            "ES2018",
            "--module",
            "commonjs",
            "--moduleResolution",
            "node",
            "--esModuleInterop",
            "--skipLibCheck",
            contractFile,
          ],
          { encoding: "utf8" }
        );
      } catch (error) {
        const diagnostic =
          typeof error === "object" &&
          error !== null &&
          "stdout" in error &&
          typeof error.stdout === "string" &&
          error.stdout.trim().length > 0
            ? error.stdout
            : typeof error === "object" &&
                error !== null &&
                "stderr" in error &&
                typeof error.stderr === "string"
              ? error.stderr
            : error instanceof Error
              ? error.message
              : String(error);
        throw new Error(diagnostic.trim());
      }
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });
});
