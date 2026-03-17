let wasmExports = null;
let heapPointer = 0;
const allocations = new Map();

function bindWasmExports(exportsObject) {
  wasmExports = exportsObject;
  heapPointer = 0;
  allocations.clear();
}

function ensureMemoryExport() {
  if (!wasmExports || !wasmExports.memory || !wasmExports.memory.buffer) {
    return null;
  }
  return wasmExports.memory;
}

function ensureMemoryView() {
  const memory = ensureMemoryExport();
  if (!memory) {
    return null;
  }
  return new Uint8Array(memory.buffer);
}

function align(value, to = 8) {
  return (value + (to - 1)) & ~(to - 1);
}

function ensureHeap(size) {
  const memory = ensureMemoryExport();
  if (!memory) return null;

  if (heapPointer === 0) {
    heapPointer = align(memory.buffer.byteLength);
  }

  const needed = heapPointer + size;
  if (needed > memory.buffer.byteLength) {
    const pageSize = 64 * 1024;
    const extra = needed - memory.buffer.byteLength;
    const pages = Math.ceil(extra / pageSize);
    memory.grow(pages);
  }
  return memory;
}

function allocate(size) {
  const normalized = Math.max(align(size), 8);
  const memory = ensureHeap(normalized);
  if (!memory) return 0;
  const ptr = heapPointer;
  heapPointer += normalized;
  allocations.set(ptr, normalized);
  return ptr;
}

module.exports = {
  __bindWasmExports: bindWasmExports,

  iswspace(value) {
    return /\s/u.test(String.fromCodePoint(value >>> 0)) ? 1 : 0;
  },

  iswalpha(value) {
    return /\p{L}/u.test(String.fromCodePoint(value >>> 0)) ? 1 : 0;
  },

  iswalnum(value) {
    return /[\p{L}\p{N}]/u.test(String.fromCodePoint(value >>> 0)) ? 1 : 0;
  },

  towlower(value) {
    return String.fromCodePoint(value >>> 0).toLowerCase().codePointAt(0) ?? value;
  },

  strcmp(ptr1, ptr2) {
    const memory = ensureMemoryView();
    if (!memory) return 0;
    let i = ptr1 >>> 0;
    let j = ptr2 >>> 0;
    while (true) {
      const a = memory[i];
      const b = memory[j];
      if (a !== b) return a < b ? -1 : 1;
      if (a === 0) return 0;
      i++;
      j++;
    }
  },

  malloc(size) {
    return allocate(size >>> 0);
  },

  calloc(count, size) {
    const total = (count >>> 0) * (size >>> 0);
    const ptr = allocate(total);
    const memory = ensureMemoryView();
    if (memory && total > 0) {
      memory.fill(0, ptr, ptr + total);
    }
    return ptr;
  },

  realloc(ptr, size) {
    const oldPtr = ptr >>> 0;
    const newSize = size >>> 0;
    const newPtr = allocate(newSize);
    const memory = ensureMemoryView();
    const oldSize = allocations.get(oldPtr) ?? 0;
    if (memory && oldPtr !== 0 && newPtr !== 0 && oldSize > 0 && newSize > 0) {
      const copySize = Math.min(oldSize, newSize);
      memory.copyWithin(newPtr, oldPtr, oldPtr + copySize);
    }
    allocations.delete(oldPtr);
    return newPtr;
  },

  free(ptr) {
    allocations.delete(ptr >>> 0);
  },

  fprintf() { return 0; },
  abort() { throw new Error("env.abort called by rust-tree-sitter bridge"); },
  __assert_fail() { throw new Error("env.__assert_fail called by rust-tree-sitter bridge"); },
  snprintf() { return 0; },
  vsnprintf() { return 0; },
  fclose() { return 0; },
  fdopen() { return 0; },
  clock_gettime() { return -1; },
  fwrite() { return 0; },
  fputc(ch) { return ch | 0; },
};
