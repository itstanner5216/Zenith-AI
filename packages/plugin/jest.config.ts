import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
  // Specify the correct root directories for Jest to look for test files
  roots: ['<rootDir>'],

  // Use TypeScript for Jest
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { diagnostics: false }],
  },

  // Module name mapper for Obsidian and other aliases
  moduleNameMapper: {
    '^obsidian$': '<rootDir>/__mocks__/obsidian.ts',
    '^tiktoken/init$': '<rootDir>/__mocks__/tiktoken/init.ts',
    '^tiktoken/tiktoken_bg.wasm$': '<rootDir>/__mocks__/tiktoken/wasm.ts',
    '^./services/logger$': '<rootDir>/__mocks__/services/logger.ts',
    '^../services/logger$': '<rootDir>/__mocks__/services/logger.ts',
    '^../../services/logger$': '<rootDir>/__mocks__/services/logger.ts',
    // Ensure a single React instance for renderHook to work correctly
    '^react$': '<rootDir>/node_modules/react',
    '^react-dom$': '<rootDir>/node_modules/react-dom',
    '^react-dom/client$': '<rootDir>/node_modules/react-dom/client',
  },

  // Module file extensions for importing
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],

  // Test environment — node by default; use @jest-environment jsdom docblock in specific files
  testEnvironment: 'node',

  // Test file pattern
  testMatch: ['**/**/*.test.ts', '**/**/*.test.tsx'],

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],

  testTimeout: 30000, // 30 seconds

  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/services/patch-engine/testing/',
  ],
};

export default config;

