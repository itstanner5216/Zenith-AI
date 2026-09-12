// Jest setup file for plugin tests
import '@testing-library/jest-dom';

// Polyfill TransformStream for jsdom environment (used by AI SDK internals)
if (typeof TransformStream === 'undefined') {
  const { TransformStream: TS } = require('stream/web');
  (global as any).TransformStream = TS;
}

// Polyfill TextDecoder/TextEncoder for jsdom environment (used by AI SDK internals)
if (typeof TextDecoder === 'undefined' || typeof TextEncoder === 'undefined') {
  const { TextDecoder: TD, TextEncoder: TE } = require('util');
  (global as any).TextDecoder = TD;
  (global as any).TextEncoder = TE;
}

