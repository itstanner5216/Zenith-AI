## Layer 6: Cleanup

### Task 6.1 — Remove `@ai-sdk/react` import from chat.tsx

After the swap, `@ai-sdk/react` should have no remaining imports in chat.tsx. Search the entire codebase for any remaining `@ai-sdk/react` usage:

```bash
cd /home/tanner/Projects/Zenith-AI && grep -r "@ai-sdk/react" packages/plugin/ --include="*.ts" --include="*.tsx"
```

If only `package.json` remains, evaluate whether to keep or remove the dependency. The `UIMessage` type now comes from `"ai"` directly, so `@ai-sdk/react` may be fully removable.

### Task 6.2 — Run deletion verification for removed symbols

```bash
cd /home/tanner/Projects/Zenith-AI && ./scripts/verify-deletion.sh "API_KEY" "getApiKey" "selectedModel"
```

### Task 6.3 — TypeScript typecheck

```bash
cd /home/tanner/Projects/Zenith-AI/packages/plugin && npx tsc --noEmit
```

Fix any remaining type errors from the integration.

### Task 6.4 — Run all tests

```bash
cd /home/tanner/Projects/Zenith-AI/packages/plugin && pnpm test
```

### Task 6.5 — Build

```bash
cd /home/tanner/Projects/Zenith-AI/packages/plugin && rm -rf dist && pnpm build
```

### Task 6.6 — Final verification

```bash
cd /home/tanner/Projects/Zenith-AI && ./scripts/verify-deletion.sh "API_KEY" "getApiKey" "selectedModel" "useChat" "@ai-sdk/react"
```

