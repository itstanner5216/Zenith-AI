import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
  roots: ['<rootDir>'],

  transform: {
    '^.+\\.tsx?$': ['ts-jest', { diagnostics: false, tsconfig: { module: 'commonjs' } }],
  },

  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },

  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

  testEnvironment: 'node',

  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],

  testPathIgnorePatterns: [
    '/node_modules/',
    '/.next/',
  ],

  testTimeout: 30000,
};

export default config;
