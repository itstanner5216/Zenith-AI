export interface Task13ContractInputs {
  path: string;
  sourceHash16: string;
  reason: string;
  idempotencyKey: string;
  currentHash16: string;
  fileSizeBytes: number;
  threshold: number;
}

export function generateTask13ContractSource(
  inputs: Task13ContractInputs
): string {
  return `
import type {
  ApplyResult,
  CheckFreshResult,
  EditDocumentRequest,
  StructuralOutlineResult
} from "../../../types";

const outline: StructuralOutlineResult = {
  path: ${JSON.stringify(inputs.path)},
  sourceFileHash16: ${JSON.stringify(inputs.sourceHash16)},
  origin: "vault",
  outline: [],
  generatedAt: Date.now(),
  fileSizeBytes: ${inputs.fileSizeBytes},
  currentBudgetThreshold: ${inputs.threshold}
};

const request: EditDocumentRequest = {
  path: ${JSON.stringify(inputs.path)},
  sourceFileHash16: ${JSON.stringify(inputs.sourceHash16)},
  target: { hash: "deadbeef" },
  operation: "replace",
  content: "replacement",
  reason: ${JSON.stringify(inputs.reason)},
  contentWitness: "current excerpt",
  witnessBytes: 64,
  idempotencyKey: ${JSON.stringify(inputs.idempotencyKey)}
};

const result: ApplyResult = {
  success: true,
  idempotencyKey: ${JSON.stringify(inputs.idempotencyKey)},
  updatedOutline: outline.outline,
  newSourceFileHash16: ${JSON.stringify(inputs.currentHash16)}
};

const freshness: CheckFreshResult = {
  fresh: true,
  currentHash16: ${JSON.stringify(inputs.currentHash16)},
  lastModified: Date.now(),
  pendingVaultEvents: false
};

void [outline, request, result, freshness];
`;
}
