/**
 * Obsidian-specific syntax classification for the patch engine.
 * Every Obsidian-specific markdown construct has exactly one v1 policy.
 */

/** How the engine treats an Obsidian-specific construct at the structural level. */
export type ObsidianSyntaxClassification =
  | "structurally_supported"    // parsed into its own StructuralNode, targetable by hash
  | "preserved_as_inline"       // stays inside its parent paragraph/section, not independently targetable
  | "opaque_block"              // own node but only whole-block replace/delete (like frontmatter/tables)
  | "unsupported_fail_closed";  // engine does not parse; edits to regions containing this construct require manual handling

/** How the construct appears in the outline. */
export type OutlineBehavior =
  | "own_entry"        // appears as its own outline entry
  | "inside_parent"    // stays inside a parent entry
  | "excluded";        // not shown in outline

/** Policy for a single Obsidian-specific construct. */
export interface ObsidianSyntaxPolicy {
  /** Human-readable construct name. */
  readonly name: string;
  /** v1 structural classification. */
  readonly classification: ObsidianSyntaxClassification;
  /** How this construct appears in the outline. */
  readonly outlineBehavior: OutlineBehavior;
  /** Notes about byte-correctness concerns or known issues. */
  readonly notes: string;
}

/** Complete v1 policy map for all Obsidian-specific constructs. */
export const OBSIDIAN_SYNTAX_POLICIES: Record<string, ObsidianSyntaxPolicy> = {
  callout: {
    name: "Callout",
    classification: "opaque_block",
    outlineBehavior: "own_entry",
    notes: "Callouts are blockquote variants. Treated as opaque blocks — whole-block replace/delete only. Nested callouts stay within parent callout node.",
  },
  wiki_link: {
    name: "Wiki Link",
    classification: "preserved_as_inline",
    outlineBehavior: "inside_parent",
    notes: "Wiki-links are inline syntax within paragraphs. Multi-byte characters in targets require byte-correct slicing.",
  },
  embed: {
    name: "Embed",
    classification: "preserved_as_inline",
    outlineBehavior: "inside_parent",
    notes: "Embeds (![[...]]) are inline. Image embeds and note embeds treated identically at structural level.",
  },
  dataview_block: {
    name: "Dataview Block",
    classification: "opaque_block",
    outlineBehavior: "own_entry",
    notes: "Fenced code blocks with language 'dataview' or 'dataviewjs'. Treated as opaque code blocks.",
  },
  dataview_inline: {
    name: "Dataview Inline",
    classification: "preserved_as_inline",
    outlineBehavior: "excluded",
    notes: "Inline Dataview expressions (= ...) inside paragraphs. Not independently targetable.",
  },
  templater: {
    name: "Templater Syntax",
    classification: "unsupported_fail_closed",
    outlineBehavior: "excluded",
    notes: "Templater syntax (<% ... %>) can produce arbitrary content. Engine does not parse or edit regions containing active Templater directives.",
  },
  mathjax_block: {
    name: "MathJax Block",
    classification: "opaque_block",
    outlineBehavior: "own_entry",
    notes: "Block-level math ($$...$$). Treated as opaque — whole-block operations only. Delimiters must be byte-preserved.",
  },
  mathjax_inline: {
    name: "MathJax Inline",
    classification: "preserved_as_inline",
    outlineBehavior: "excluded",
    notes: "Inline math ($...$). Preserved within parent paragraph. Delimiter bytes must not be corrupted by edits.",
  },
  nested_blockquote: {
    name: "Nested Blockquote",
    classification: "structurally_supported",
    outlineBehavior: "inside_parent",
    notes: "Nested blockquotes (> > >) are structurally supported through the blockquote node type. Depth tracked via nesting.",
  },
} as const;

/** Look up the v1 policy for an Obsidian construct by key. */
export function getObsidianSyntaxPolicy(key: string): ObsidianSyntaxPolicy | undefined {
  return OBSIDIAN_SYNTAX_POLICIES[key];
}

/**
 * Default policy for unrecognized Obsidian-specific constructs.
 *
 * Unknown syntax is fail-closed: the engine does not attempt to parse
 * or edit regions containing unrecognized constructs.
 */
export const UNKNOWN_SYNTAX_POLICY: ObsidianSyntaxPolicy = {
  name: "Unknown Obsidian Syntax",
  classification: "unsupported_fail_closed",
  outlineBehavior: "excluded",
  notes: "Unrecognized Obsidian-specific construct. Fail-closed by default — engine does not attempt to parse or edit.",
};

/**
 * Look up the v1 policy for an Obsidian construct by key,
 * falling back to fail-closed for unknown constructs.
 */
export function getObsidianSyntaxPolicyOrDefault(key: string): ObsidianSyntaxPolicy {
  return OBSIDIAN_SYNTAX_POLICIES[key] ?? UNKNOWN_SYNTAX_POLICY;
}
