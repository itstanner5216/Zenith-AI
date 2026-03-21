# GitHub PR & Code Review Mode Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a scoped GitHub PR & Code Review mode that gives the assistant read/write access to GitHub repositories — read source code, review pull requests, push edits, and merge — through the existing mode-scoped tool system.

**Architecture:** The mode is a declarative manifest registered in the mode system. It exposes ~10 GitHub-specific tools via the mode allowlist. Tool handlers in the plugin make direct REST API calls to `api.github.com` using a stored Personal Access Token. No MCP server dependency at runtime — the plugin is self-contained. The tool schemas mirror GitHub's REST API surface and align with the GitHub MCP server's capabilities, so the mental model is consistent.

**Execution Position:** After Mode Tooling (Plan 2) and Mode Runtime (Plan 3). Requires `AssistantModeId`, `AssistantModeManifest`, `ToolId`, mode registry, tool allowlists, session-scoped mode state, and mode-aware prompt building to already exist. Independent of Background Scribe, Cosmic Context, and Auto-Sort Tuner — can run before or alongside them.

**Tech Stack:** Obsidian plugin TypeScript, React, Zustand, GitHub REST API v3 (`api.github.com`), existing mode/tool infrastructure from Plans 2–3.

---

## Mode Tool Surface

**Present to model:**
- `ghGetFileContents` — read any file at any branch/commit/tag
- `ghSearchCode` — search for patterns across repo code
- `ghListPullRequests` — list PRs with state/branch filters
- `ghGetPullRequestDetails` — get PR metadata, diff, changed files
- `ghGetPullRequestComments` — get review threads and comments
- `ghAddReview` — approve, request changes, or leave a general comment
- `ghAddReviewComment` — inline comment on a specific file/line in a PR
- `ghCreateOrUpdateFile` — push a file change to a branch (create or edit)
- `ghMergePullRequest` — merge a PR (requires confirmation)
- `ghListBranches` — list repo branches

**Runtime-only, not tools:**
- Token management
- Repo context resolution (default owner/repo from settings or session)
- Error handling and rate limit awareness

---

### Task 1: Add GitHub Integration Settings

**Files:**
- Modify: `packages/plugin/settings.ts`
- Modify: `packages/plugin/views/settings/general-tab.tsx`

**Step 1: Extend the settings interface**

Add to `ZenithAISettings`:

```ts
// GitHub Integration
githubToken = "";
githubDefaultOwner = "";
githubDefaultRepo = "";
```

These are simple string fields with empty defaults. The token is a GitHub Personal Access Token (classic or fine-grained) with `repo` scope.

**Step 2: Add settings UI**

In `general-tab.tsx`, add a "GitHub Integration" section with:
- Token input (password-masked, with a "Test Connection" button that calls `GET /user`)
- Default owner input
- Default repo input
- Help text: "Required for the GitHub PR & Code Review mode. Generate a token at github.com/settings/tokens with `repo` scope."

**Step 3: Verify**

Run:
```bash
cd packages/plugin && pnpm exec tsc --noEmit
```

Expected:
- typecheck passes
- settings persist and load correctly

---

### Task 2: Create The GitHub API Service

**Files:**
- Create: `packages/plugin/services/github-api.ts`
- Create: `packages/plugin/services/github-api-types.ts`

**Step 1: Define response types**

In `github-api-types.ts`, add typed interfaces for:
- `GitHubFile` (path, content, sha, encoding)
- `GitHubPullRequest` (number, title, state, head, base, user, body, mergeable, etc.)
- `GitHubReview` (id, user, state, body)
- `GitHubReviewComment` (id, path, line, body, user, diff_hunk)
- `GitHubBranch` (name, commit sha, protected)
- `GitHubSearchResult` (items with path, repository, text_matches)
- `GitHubCommitFile` (filename, status, additions, deletions, patch)

Keep these minimal — only the fields the tool handlers actually need.

**Step 2: Implement the API service**

In `github-api.ts`, create a class:

```ts
export class GitHubAPIService {
  constructor(private token: string) {}

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T>

  // Repository
  async getFileContents(owner: string, repo: string, path: string, ref?: string): Promise<GitHubFile>
  async searchCode(query: string, owner?: string, repo?: string): Promise<GitHubSearchResult>
  async listBranches(owner: string, repo: string): Promise<GitHubBranch[]>

  // Pull Requests
  async listPullRequests(owner: string, repo: string, state?: string, head?: string, base?: string): Promise<GitHubPullRequest[]>
  async getPullRequest(owner: string, repo: string, number: number): Promise<GitHubPullRequest>
  async getPullRequestDiff(owner: string, repo: string, number: number): Promise<string>
  async getPullRequestFiles(owner: string, repo: string, number: number): Promise<GitHubCommitFile[]>
  async getPullRequestComments(owner: string, repo: string, number: number): Promise<GitHubReviewComment[]>

  // Review Actions
  async addReview(owner: string, repo: string, number: number, event: string, body?: string): Promise<GitHubReview>
  async addReviewComment(owner: string, repo: string, number: number, body: string, path: string, line: number, side?: string): Promise<GitHubReviewComment>

  // Write Operations
  async createOrUpdateFile(owner: string, repo: string, path: string, content: string, message: string, branch: string, sha?: string): Promise<{ commit: { sha: string } }>
  async mergePullRequest(owner: string, repo: string, number: number, mergeMethod?: string, commitTitle?: string): Promise<{ merged: boolean; message: string }>
}
```

**Step 3: Add error handling**

All methods should:
- Throw typed errors with HTTP status and GitHub error message
- Handle 401 (bad token) with a clear "check your GitHub token" message
- Handle 403 (rate limit or permissions) with rate limit info
- Handle 404 (repo/file not found) with clear context
- Handle 422 (merge conflict, validation error) with the API's error detail

**Step 4: Verify**

Run:
```bash
cd packages/plugin && pnpm exec tsc --noEmit
```

---

### Task 3: Define GitHub Tool Schemas

**Files:**
- Modify: `packages/web/app/api/(newai)/chat/tools.ts`

**Step 1: Add GitHub tool schemas to the tool registry**

Add these Zod-validated tool definitions:

```ts
ghGetFileContents: {
  description: "Read a file from a GitHub repository at a specific branch, tag, or commit. Returns the file content decoded from base64. Use this to inspect source code, configuration, or any file in the repo.",
  parameters: z.object({
    owner: z.string().describe("Repository owner (username or org)"),
    repo: z.string().describe("Repository name"),
    path: z.string().describe("Path to the file within the repo (e.g. 'src/index.ts')"),
    ref: z.string().optional().describe("Branch name, tag, or commit SHA. Defaults to the repo's default branch"),
  }),
},

ghSearchCode: {
  description: "Search for code patterns across a GitHub repository. Returns matching file paths and code snippets. Use this to find implementations, usages, or patterns.",
  parameters: z.object({
    query: z.string().describe("Search query. Supports GitHub code search syntax (e.g. 'useState language:tsx', 'className path:src/components')"),
    owner: z.string().describe("Repository owner"),
    repo: z.string().describe("Repository name"),
  }),
},

ghListPullRequests: {
  description: "List pull requests in a GitHub repository. Returns PR numbers, titles, authors, and status.",
  parameters: z.object({
    owner: z.string().describe("Repository owner"),
    repo: z.string().describe("Repository name"),
    state: z.enum(["open", "closed", "all"]).optional().describe("Filter by PR state. Defaults to 'open'"),
    base: z.string().optional().describe("Filter by base branch (e.g. 'master', 'main')"),
    head: z.string().optional().describe("Filter by head branch"),
  }),
},

ghGetPullRequestDetails: {
  description: "Get detailed information about a pull request including its diff and changed files. Use this to understand what a PR changes before reviewing.",
  parameters: z.object({
    owner: z.string().describe("Repository owner"),
    repo: z.string().describe("Repository name"),
    pullNumber: z.number().describe("Pull request number"),
    includeDiff: z.boolean().optional().describe("Include the full unified diff. Defaults to true"),
    includeFiles: z.boolean().optional().describe("Include the list of changed files with stats. Defaults to true"),
  }),
},

ghGetPullRequestComments: {
  description: "Get review comments and discussion threads on a pull request.",
  parameters: z.object({
    owner: z.string().describe("Repository owner"),
    repo: z.string().describe("Repository name"),
    pullNumber: z.number().describe("Pull request number"),
  }),
},

ghAddReview: {
  description: "Submit a review on a pull request. Can approve, request changes, or leave a general comment. This is a significant action — only use when the user explicitly asks to review or approve.",
  parameters: z.object({
    owner: z.string().describe("Repository owner"),
    repo: z.string().describe("Repository name"),
    pullNumber: z.number().describe("Pull request number"),
    event: z.enum(["APPROVE", "REQUEST_CHANGES", "COMMENT"]).describe("Review action"),
    body: z.string().optional().describe("Review comment body. Required for REQUEST_CHANGES, optional for APPROVE"),
  }),
},

ghAddReviewComment: {
  description: "Add an inline review comment on a specific file and line in a pull request diff.",
  parameters: z.object({
    owner: z.string().describe("Repository owner"),
    repo: z.string().describe("Repository name"),
    pullNumber: z.number().describe("Pull request number"),
    body: z.string().describe("Comment text"),
    path: z.string().describe("File path relative to repo root"),
    line: z.number().describe("Line number in the diff to comment on"),
    side: z.enum(["LEFT", "RIGHT"]).optional().describe("Which side of the diff. Defaults to RIGHT (new code)"),
  }),
},

ghCreateOrUpdateFile: {
  description: "Create or update a file in a GitHub repository by pushing a commit to a branch. Use this to fix issues found during review or to push code changes. Always push to a feature branch, never to the default branch directly.",
  parameters: z.object({
    owner: z.string().describe("Repository owner"),
    repo: z.string().describe("Repository name"),
    path: z.string().describe("File path within the repo"),
    content: z.string().describe("New file content (plain text, will be base64-encoded automatically)"),
    message: z.string().describe("Commit message describing the change"),
    branch: z.string().describe("Branch to commit to"),
    sha: z.string().optional().describe("SHA of the file being replaced (required for updates, omit for new files)"),
  }),
},

ghMergePullRequest: {
  description: "Merge a pull request. This is a destructive action — only use when the user explicitly requests a merge. Always confirm with the user before merging.",
  parameters: z.object({
    owner: z.string().describe("Repository owner"),
    repo: z.string().describe("Repository name"),
    pullNumber: z.number().describe("Pull request number"),
    mergeMethod: z.enum(["merge", "squash", "rebase"]).optional().describe("Merge strategy. Defaults to 'merge'"),
    commitTitle: z.string().optional().describe("Custom merge commit title"),
  }),
},

ghListBranches: {
  description: "List branches in a GitHub repository.",
  parameters: z.object({
    owner: z.string().describe("Repository owner"),
    repo: z.string().describe("Repository name"),
  }),
},
```

**Step 2: Verify schema consistency**

Ensure all tool names follow the `gh` prefix convention and parameter types are consistent across related tools.

**Step 3: Verify**

Run:
```bash
cd packages/plugin && pnpm exec tsc --noEmit
```

---

### Task 4: Extend ToolId And Create Mode Allowlist

**Files:**
- Modify: `packages/plugin/modes/tool-capabilities.ts`
- Modify: `packages/plugin/modes/tool-allowlists.ts`

**Step 1: Extend the ToolId union**

Add to the existing `ToolId` type:

```ts
| "ghGetFileContents"
| "ghSearchCode"
| "ghListPullRequests"
| "ghGetPullRequestDetails"
| "ghGetPullRequestComments"
| "ghAddReview"
| "ghAddReviewComment"
| "ghCreateOrUpdateFile"
| "ghMergePullRequest"
| "ghListBranches"
```

**Step 2: Add tool capability metadata**

Register each GitHub tool with its capability flags:

```ts
{ id: "ghGetFileContents", destructive: false, requiresConfirmation: false, modeScoped: true },
{ id: "ghSearchCode", destructive: false, requiresConfirmation: false, modeScoped: true },
{ id: "ghListPullRequests", destructive: false, requiresConfirmation: false, modeScoped: true },
{ id: "ghGetPullRequestDetails", destructive: false, requiresConfirmation: false, modeScoped: true },
{ id: "ghGetPullRequestComments", destructive: false, requiresConfirmation: false, modeScoped: true },
{ id: "ghAddReview", destructive: false, requiresConfirmation: true, modeScoped: true },
{ id: "ghAddReviewComment", destructive: false, requiresConfirmation: false, modeScoped: true },
{ id: "ghCreateOrUpdateFile", destructive: true, requiresConfirmation: true, modeScoped: true },
{ id: "ghMergePullRequest", destructive: true, requiresConfirmation: true, modeScoped: true },
{ id: "ghListBranches", destructive: false, requiresConfirmation: false, modeScoped: true },
```

**Step 3: Create the mode allowlist**

In `tool-allowlists.ts`, add:

```ts
export const githubPrTools: ToolId[] = [
  "ghGetFileContents",
  "ghSearchCode",
  "ghListPullRequests",
  "ghGetPullRequestDetails",
  "ghGetPullRequestComments",
  "ghAddReview",
  "ghAddReviewComment",
  "ghCreateOrUpdateFile",
  "ghMergePullRequest",
  "ghListBranches",
];
```

**Step 4: Verify**

Run:
```bash
cd packages/plugin && pnpm exec tsc --noEmit
```

---

### Task 5: Create GitHub Tool Handlers

**Files:**
- Create: `packages/plugin/views/assistant/ai-chat/tool-handlers/gh-get-file-contents-handler.tsx`
- Create: `packages/plugin/views/assistant/ai-chat/tool-handlers/gh-search-code-handler.tsx`
- Create: `packages/plugin/views/assistant/ai-chat/tool-handlers/gh-list-pull-requests-handler.tsx`
- Create: `packages/plugin/views/assistant/ai-chat/tool-handlers/gh-get-pr-details-handler.tsx`
- Create: `packages/plugin/views/assistant/ai-chat/tool-handlers/gh-get-pr-comments-handler.tsx`
- Create: `packages/plugin/views/assistant/ai-chat/tool-handlers/gh-add-review-handler.tsx`
- Create: `packages/plugin/views/assistant/ai-chat/tool-handlers/gh-add-review-comment-handler.tsx`
- Create: `packages/plugin/views/assistant/ai-chat/tool-handlers/gh-create-or-update-file-handler.tsx`
- Create: `packages/plugin/views/assistant/ai-chat/tool-handlers/gh-merge-pr-handler.tsx`
- Create: `packages/plugin/views/assistant/ai-chat/tool-handlers/gh-list-branches-handler.tsx`
- Modify: `packages/plugin/views/assistant/ai-chat/tool-handlers/tool-invocation-handler.tsx`

**Step 1: Follow the existing handler pattern**

Each handler is a React component that:
1. Receives `toolInvocation`, `handleAddResult`, and `app` as props
2. Resolves default `owner`/`repo` from plugin settings when not provided in the tool call
3. Instantiates `GitHubAPIService` with the stored token
4. Makes the API call
5. Renders the result in the chat UI
6. Calls `handleAddResult(JSON.stringify(result))` to return data to the model

**Step 2: Implement read-only handlers**

For `ghGetFileContents`:
- Render file content in a code block with syntax highlighting based on file extension
- Return the decoded content to the model

For `ghSearchCode`:
- Render matching file paths and snippet previews
- Return structured results to the model

For `ghListPullRequests`:
- Render a compact list with PR number, title, author, state, and branch info
- Return the list to the model

For `ghGetPullRequestDetails`:
- Render PR metadata (title, author, base/head, description)
- Render the diff with file-by-file expansion
- Render changed file stats (additions/deletions)
- Return structured data to the model

For `ghGetPullRequestComments`:
- Render threaded review comments with file/line context
- Return comments to the model

For `ghListBranches`:
- Render branch names in a compact list
- Return the list to the model

**Step 3: Implement write handlers with confirmation**

For `ghAddReview`:
- Show a confirmation panel: "Submit [APPROVE/REQUEST_CHANGES/COMMENT] review on PR #N?"
- Display the review body if present
- Require explicit user click to submit
- Only call `handleAddResult` after submission or cancellation

For `ghAddReviewComment`:
- Show the comment text and target file/line
- Submit immediately (inline comments are low-risk)
- Return confirmation to the model

For `ghCreateOrUpdateFile`:
- Show a diff preview of the proposed change (if updating) or the new file content (if creating)
- Show the commit message and target branch
- Require explicit user confirmation before pushing
- Return the commit SHA on success

For `ghMergePullRequest`:
- Show a prominent confirmation: "Merge PR #N into [base branch]?"
- Display the merge method
- Require explicit user click
- Return merge result to the model

**Step 4: Register handlers in the dispatcher**

In `tool-invocation-handler.tsx`, add handler mappings:

```ts
ghGetFileContents: () => <GhGetFileContentsHandler ... />,
ghSearchCode: () => <GhSearchCodeHandler ... />,
ghListPullRequests: () => <GhListPullRequestsHandler ... />,
ghGetPullRequestDetails: () => <GhGetPrDetailsHandler ... />,
ghGetPullRequestComments: () => <GhGetPrCommentsHandler ... />,
ghAddReview: () => <GhAddReviewHandler ... />,
ghAddReviewComment: () => <GhAddReviewCommentHandler ... />,
ghCreateOrUpdateFile: () => <GhCreateOrUpdateFileHandler ... />,
ghMergePullRequest: () => <GhMergePrHandler ... />,
ghListBranches: () => <GhListBranchesHandler ... />,
```

Add display titles to the title map:

```ts
ghGetFileContents: "Reading File",
ghSearchCode: "Searching Code",
ghListPullRequests: "Listing Pull Requests",
ghGetPullRequestDetails: "Loading PR Details",
ghGetPullRequestComments: "Loading PR Comments",
ghAddReview: "Submitting Review",
ghAddReviewComment: "Adding Comment",
ghCreateOrUpdateFile: "Pushing Changes",
ghMergePullRequest: "Merging Pull Request",
ghListBranches: "Listing Branches",
```

**Step 5: Verify**

Run:
```bash
cd packages/plugin && pnpm exec tsc --noEmit
```

---

### Task 6: Create The GitHub PR Mode Manifest

**Files:**
- Create: `packages/plugin/modes/github-pr-mode.ts`

**Step 1: Implement the mode manifest**

```ts
import type { AssistantModeManifest } from "./mode-types";
import { githubPrTools } from "./tool-allowlists";

export const githubPrMode: AssistantModeManifest = {
  id: "github-pr",
  displayName: "GitHub PR",
  buildSystemPrompt: () => GITHUB_PR_PROMPT,
  allowedTools: githubPrTools,
  retrievalPolicy: { type: "none" },
  activationSurface: "mode-selector",
  supportsBackgroundRun: false,
};
```

**Step 2: Write the mode prompt**

The prompt should instruct the model to:

```
You are a code-aware GitHub assistant scoped to pull request review and repository navigation.

**Your capabilities:**
- Read any file in a GitHub repository at any branch or commit
- Search code across a repository
- List, inspect, and review pull requests
- Add inline review comments on specific lines
- Push file changes to branches (create or update)
- Merge pull requests when explicitly asked

**Behavioral rules:**
- When the user asks about code, READ the actual source files before answering. Do not guess or rely on memory.
- When reviewing a PR, start by reading the diff and changed files. Provide specific, actionable feedback.
- When pushing changes, always push to a feature branch. Never push directly to the default branch.
- When merging, always confirm with the user first. State the PR number, base branch, and merge method.
- Default owner and repo come from the user's settings. If a request is ambiguous about which repo, ask.
- Use ghSearchCode to find related code before suggesting changes.
- Keep review comments specific and line-targeted when possible.
- For large diffs, summarize the changes first, then offer to drill into specific files.

**You do NOT have access to:**
- The local Obsidian vault (use other modes for that)
- CI/CD pipelines or GitHub Actions
- Issue creation or project boards
- Repository settings or admin operations
```

**Step 3: Verify**

Run:
```bash
cd packages/plugin && pnpm exec tsc --noEmit
```

---

### Task 7: Register The Mode

**Files:**
- Modify: `packages/plugin/modes/mode-types.ts`
- Modify: `packages/plugin/modes/mode-registry.ts`
- Modify: `packages/plugin/modes/index.ts`

**Step 1: Extend AssistantModeId**

Add `"github-pr"` to the `AssistantModeId` union type.

**Step 2: Register the mode**

In `mode-registry.ts`, import and register `githubPrMode`:

```ts
import { githubPrMode } from "./github-pr-mode";

// In the registry
registry.set("github-pr", githubPrMode);
```

**Step 3: Export from barrel**

In `modes/index.ts`, ensure `githubPrMode` is re-exported.

**Step 4: Verify**

Run:
```bash
cd packages/plugin && pnpm exec tsc --noEmit
```

Expected:
- mode registry includes `github-pr`
- mode selector UI can render the new mode option

---

### Task 8: Add PR Review Display Components

**Files:**
- Create: `packages/plugin/views/assistant/ai-chat/components/gh-diff-viewer.tsx`
- Create: `packages/plugin/views/assistant/ai-chat/components/gh-pr-card.tsx`
- Create: `packages/plugin/views/assistant/ai-chat/components/gh-file-content-viewer.tsx`

**Step 1: Build a diff viewer component**

`GhDiffViewer` should:
- Accept a unified diff string
- Parse it into file-level hunks
- Render additions (green), deletions (red), and context lines
- Use the design system tokens:
  - `bg-[var(--bg-depth-2)]` for the diff container
  - `text-[var(--text-primary)]` for content
  - `border-[var(--border-subtle)]` for hunk separators
- Support collapsible file sections for large diffs
- Show file-level stats (+ additions, - deletions)

**Step 2: Build a PR card component**

`GhPrCard` should:
- Show PR number, title, author, state badge
- Show base ← head branch info
- Show changed file count and line stats
- Use compact layout suitable for chat sidebar width
- State badges: open (green), closed (red), merged (purple)

**Step 3: Build a file content viewer**

`GhFileContentViewer` should:
- Render file contents in a scrollable code block
- Show line numbers
- Include the file path and branch/ref as header
- Support syntax highlighting via file extension detection

**Step 4: Verify**

Run:
```bash
cd packages/plugin && pnpm exec tsc --noEmit
```

---

### Task 9: Gate GitHub Tools Behind Token Availability

**Files:**
- Modify: `packages/plugin/views/assistant/ai-chat/chat.tsx`
- Modify: `packages/plugin/modes/resolve-allowed-tools.ts`

**Step 1: Check token before exposing GitHub tools**

When the active mode is `github-pr`, check whether `settings.githubToken` is set. If not:
- Do not include GitHub tools in the request
- Show a notice in the chat: "GitHub token not configured. Set it in Settings → GitHub Integration."

**Step 2: Pass resolved owner/repo defaults into context**

When building the request body for `github-pr` mode, include the default owner and repo in the context so the model can use them without asking every time:

```
GitHub defaults: owner={settings.githubDefaultOwner}, repo={settings.githubDefaultRepo}
```

**Step 3: Verify**

Run:
```bash
cd packages/plugin && pnpm exec tsc --noEmit
```

Expected:
- switching to GitHub PR mode without a token shows a helpful message
- switching with a valid token exposes the tools normally

---

### Task 10: Final Verification

**Files:**
- Whole mode surface

**Step 1: Typecheck**

Run:
```bash
cd packages/plugin && pnpm exec tsc --noEmit
```

Expected:
- exit code `0`

**Step 2: Manual smoke test**

Verify:
- GitHub token saves and loads from settings
- "Test Connection" button validates the token
- Switching to GitHub PR mode shows only GitHub tools
- Switching away from GitHub PR mode hides GitHub tools
- `ghListPullRequests` returns and renders PR list
- `ghGetPullRequestDetails` renders diff and file changes
- `ghGetFileContents` renders file with syntax highlighting
- `ghCreateOrUpdateFile` shows confirmation before pushing
- `ghMergePullRequest` shows confirmation before merging
- Non-GitHub modes do not expose any `gh*` tools

**Step 3: Verify mode isolation**

Confirm:
- In Project Copilot mode: no `gh*` tools available
- In Background Scribe mode: no `gh*` tools available
- In GitHub PR mode: no vault editing tools available (`editDocument`, `createNewFiles`, etc.)

**Step 4: Commit**

```bash
git add packages/plugin packages/web docs/plans
git commit -m "feat: add GitHub PR & Code Review mode"
```
