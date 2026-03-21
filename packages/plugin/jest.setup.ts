// Jest setup file for plugin tests
import '@testing-library/jest-dom';

// Polyfill TransformStream for jsdom environment (used by AI SDK internals)
if (typeof TransformStream === 'undefined') {
  const { TransformStream: TS } = require('stream/web');
  (global as any).TransformStream = TS;
}

