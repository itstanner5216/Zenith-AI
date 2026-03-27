#!/usr/bin/env node
'use strict';

/**
 * Tool definition code generator.
 *
 * Reads JSON files from tools/definitions/ and emits:
 *   tools/generated/interfaces.ts  — TypeScript input/output interfaces + PluginToolName union
 *   tools/generated/schemas.ts     — JSONSchema7-typed input schema consts for each tool
 *
 * Run with: node tools/generate.js
 */

const fs = require('fs');
const path = require('path');

const DEFS_DIR = path.join(__dirname, 'definitions');
const GEN_DIR = path.join(__dirname, 'generated');
const TIMESTAMP = new Date().toISOString();
const HEADER = `// GENERATED — do not edit manually\n// Generated at: ${TIMESTAMP}\n\n`;

// ─── Type helpers ─────────────────────────────────────────────────────────────

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Convert a simple type name to a TypeScript primitive string. */
function simpleType(t) {
  if (t === 'string') return 'string';
  if (t === 'number') return 'number';
  if (t === 'boolean') return 'boolean';
  return 'unknown';
}

/**
 * Convert a field definition (from tool JSON) to a TypeScript type string.
 * Handles primitives, arrays of primitives, and arrays of inline objects.
 */
function fieldToTSType(fieldDef) {
  if (fieldDef.type === 'string') return 'string';
  if (fieldDef.type === 'number') return 'number';
  if (fieldDef.type === 'boolean') return 'boolean';

  if (fieldDef.type === 'array') {
    const items = fieldDef.items;
    if (!items) return 'unknown[]';
    if (items.type === 'string' || items.type === 'number' || items.type === 'boolean') {
      return simpleType(items.type) + '[]';
    }
    if (items.type === 'object') {
      const props = items.properties || {};
      const reqSet = new Set(items.required || Object.keys(props));
      const inline = Object.entries(props)
        .map(([k, v]) => `${k}${reqSet.has(k) ? '' : '?'}: ${simpleType(v.type)}`)
        .join('; ');
      return `Array<{ ${inline} }>`;
    }
  }

  return 'unknown';
}

// ─── Interface generators ─────────────────────────────────────────────────────

/** Generate a named TypeScript interface from a flat field map (_items format). */
function genHelperInterface(name, items) {
  const lines = Object.entries(items).map(([field, def]) => {
    const opt = def.optional ? '?' : '';
    return `  ${field}${opt}: ${simpleType(def.type)};`;
  });
  return `export interface ${name} {\n${lines.join('\n')}\n}`;
}

/** Generate the XxxInput interface for a tool. */
function genInputInterface(tool) {
  const name = capitalize(tool.name) + 'Input';
  const lines = Object.entries(tool.input).map(([field, def]) => {
    const opt = def.optional ? '?' : '';
    return `  ${field}${opt}: ${fieldToTSType(def)};`;
  });
  return `export interface ${name} {\n${lines.join('\n')}\n}`;
}

/**
 * Generate the XxxOutput type (and any helper interfaces) for a tool.
 * Returns a string containing all needed declarations.
 */
function genOutputDeclarations(tool) {
  const name = capitalize(tool.name) + 'Output';
  const output = tool.output;
  const parts = [];

  if (output._isArray) {
    // Output is an array — emit helper interface + type alias
    parts.push(genHelperInterface(output._itemInterface, output._items));
    parts.push(`export type ${name} = ${output._itemInterface}[];`);
    return parts.join('\n\n');
  }

  // Output is an object — scan fields for array-with-named-items
  const fieldLines = [];
  for (const [field, def] of Object.entries(output)) {
    if (field.startsWith('_')) continue;
    const opt = def.optional ? '?' : '';
    if (def._itemInterface && def._items) {
      parts.push(genHelperInterface(def._itemInterface, def._items));
      fieldLines.push(`  ${field}${opt}: ${def._itemInterface}[];`);
    } else {
      fieldLines.push(`  ${field}${opt}: ${fieldToTSType(def)};`);
    }
  }
  parts.push(`export interface ${name} {\n${fieldLines.join('\n')}\n}`);
  return parts.join('\n\n');
}

// ─── Schema generators ────────────────────────────────────────────────────────

/**
 * Recursively convert a schema object to TypeScript source code.
 * Adds `as const` to every `type` field so string literals are preserved
 * and the result is assignable to JSONSchema7.
 */
function schemaToCode(schema, indent) {
  const pad = '  '.repeat(indent);
  const inner = '  '.repeat(indent + 1);
  const entries = Object.entries(schema);

  const lines = entries.map(([k, v]) => {
    if (k === 'type' && typeof v === 'string') {
      return `${inner}${k}: "${v}" as const`;
    }
    if (Array.isArray(v)) {
      return `${inner}${k}: ${JSON.stringify(v)}`;
    }
    if (v !== null && typeof v === 'object') {
      return `${inner}${k}: ${schemaToCode(v, indent + 1)}`;
    }
    return `${inner}${k}: ${JSON.stringify(v)}`;
  });

  return `{\n${lines.join(',\n')},\n${pad}}`;
}

/** Build a JSONSchema7-compatible input schema object from a tool definition. */
function buildInputSchema(tool) {
  const properties = {};
  const required = [];

  for (const [field, def] of Object.entries(tool.input)) {
    const prop = { type: def.type };
    if (def.description) prop.description = def.description;
    if (def.type === 'array' && def.items) prop.items = def.items;
    properties[field] = prop;
    if (!def.optional) required.push(field);
  }

  const schema = { type: 'object', properties };
  if (required.length > 0) schema.required = required;
  return schema;
}

// ─── Load definitions ─────────────────────────────────────────────────────────

if (!fs.existsSync(GEN_DIR)) fs.mkdirSync(GEN_DIR, { recursive: true });

const tools = fs.readdirSync(DEFS_DIR)
  .filter(f => f.endsWith('.json'))
  .sort()
  .map(f => JSON.parse(fs.readFileSync(path.join(DEFS_DIR, f), 'utf8')));

// ─── Generate interfaces.ts ───────────────────────────────────────────────────

const iLines = [HEADER];

for (const tool of tools) {
  const prefix = capitalize(tool.name);
  iLines.push(`// ─── ${prefix} ${'─'.repeat(Math.max(0, 60 - prefix.length))}`);
  iLines.push('');
  iLines.push(genInputInterface(tool));
  iLines.push('');
  iLines.push(genOutputDeclarations(tool));
  iLines.push('');
}

const toolNames = tools.map(t => `"${t.name}"`).join(' | ');
iLines.push(`export type PluginToolName = ${toolNames};\n`);

const namesArr = tools.map(t => `"${t.name}"`).join(', ');
iLines.push(`export const ALL_TOOL_NAMES: readonly PluginToolName[] = [${namesArr}];\n`);

fs.writeFileSync(path.join(GEN_DIR, 'interfaces.ts'), iLines.join('\n'));

// ─── Generate schemas.ts ──────────────────────────────────────────────────────

const sLines = [
  HEADER,
  `import type { JSONSchema7 } from "json-schema";\n`,
];

for (const tool of tools) {
  const constName = tool.name + 'Schema';
  const schema = buildInputSchema(tool);
  sLines.push(`export const ${constName}: JSONSchema7 = ${schemaToCode(schema, 0)};\n`);
}

fs.writeFileSync(path.join(GEN_DIR, 'schemas.ts'), sLines.join('\n'));

console.log(`✓ Generated tools/generated/interfaces.ts and tools/generated/schemas.ts`);
console.log(`  ${tools.length} tools: ${tools.map(t => t.name).join(', ')}`);
