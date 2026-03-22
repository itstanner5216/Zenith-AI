import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
  roots: ['<rootDir>'],

  transform: {
    '^.+\\.tsx?$': ['ts-jest', { diagnostics: false }],
  },

  moduleNameMapper: {
    '^obsidian$': '<rootDir>/__mocks__/obsidian.ts',
    '^tiktoken/init$': '<rootDir>/__mocks__/tiktoken/init.ts',
    '^tiktoken/tiktoken_bg.wasm$': '<rootDir>/__mocks__/tiktoken/wasm.ts',
    '^./services/logger$': '<rootDir>/__mocks__/services/logger.ts',
    '^../services/logger$': '<rootDir>/__mocks__/services/logger.ts',
    '^../../services/logger$': '<rootDir>/__mocks__/services/logger.ts',
    '^react$': '<rootDir>/../../node_modules/react',
    '^react-dom$': '<rootDir>/../../node_modules/react-dom',
    '^react-dom/client$': '<rootDir>/../../node_modules/react-dom/client',
  },

  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],

  testEnvironment: 'node',

  testMatch: ['**/**/*.test.ts', '**/**/*.test.tsx'],

  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],

  testTimeout: 30000,

  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/services/patch-engine/testing/',
  ],
};

export default config;
