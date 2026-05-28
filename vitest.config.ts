/**
 * Root Vitest Configuration
 *
 * Delegates test execution to the v3 package tree. Uses the same include
 * patterns as v3/vitest.config.ts but anchored from /home/user/ghost so
 * the root npm test script finds the right files.
 *
 * Key differences from v3/vitest.config.ts:
 * - root is set to './v3' so all include patterns resolve inside v3/
 * - poolOptions removed (deprecated in Vitest 4, options promoted to top level)
 * - isolate kept as top-level option
 * - externalize-optional-deps plugin included to handle @ruvector/, agentdb,
 *   agentic-flow, and HuggingFace packages that may not be installed
 */
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  plugins: [
    {
      name: 'externalize-optional-deps',
      enforce: 'pre' as const,
      resolveId(source: string) {
        // Don't let Vite resolve optional deps that may have missing subpath
        // exports. These are imported via try/catch dynamic import in src/
        // (sona-optimizer falls back to no-SONA when the package isn't
        // installed). External-marking them keeps vitest from failing
        // module resolution at transform time.
        if (source.startsWith('agentic-flow')) return { id: source, external: true };
        if (source.startsWith('agentdb')) return { id: source, external: true };
        if (source.startsWith('@ruvector/')) return { id: source, external: true };
        if (source.startsWith('@huggingface/transformers')) return { id: source, external: true };
        if (source.startsWith('@xenova/transformers')) return { id: source, external: true };
        if (source.startsWith('@noble/ed25519')) return { id: source, external: true };
        return null;
      },
    },
  ],

  resolve: {
    conditions: ['node'],
    alias: {
      '@': path.resolve(__dirname, './v3/src'),
      '@tests': path.resolve(__dirname, './v3/__tests__'),
      '@fixtures': path.resolve(__dirname, './v3/__tests__/fixtures'),
      '@helpers': path.resolve(__dirname, './v3/__tests__/helpers'),
      '@mocks': path.resolve(__dirname, './v3/__tests__/mocks'),
      '@security': path.resolve(__dirname, './v3/modules/security'),
      '@memory': path.resolve(__dirname, './v3/modules/memory'),
      '@swarm': path.resolve(__dirname, './v3/modules/swarm'),
      '@core': path.resolve(__dirname, './v3/modules/core'),
    },
  },

  test: {
    // Use v3/ as the project root so include patterns are relative to it
    root: path.resolve(__dirname, './v3'),

    // Test environment
    environment: 'node',

    // Global test setup (relative to root = v3/)
    setupFiles: ['./__tests__/setup.ts'],

    // Include patterns (relative to root = v3/)
    include: [
      '__tests__/**/*.test.ts',
      '__tests__/**/*.spec.ts',
      '@claude-flow/**/__tests__/**/*.test.ts',
      '@claude-flow/**/__tests__/**/*.spec.ts',
      'mcp/__tests__/**/*.test.ts',
      'mcp/__tests__/**/*.spec.ts',
    ],

    // Exclude patterns
    exclude: [
      'node_modules',
      'dist',
      '.git',
    ],

    // Coverage configuration
    coverage: {
      enabled: false,
    },

    // Mock configuration for London School approach
    mockReset: true,
    clearMocks: true,
    restoreMocks: true,

    // Timeout for async operations.
    // Bumped from 10s -> 30s because CI runners cold-load HuggingFace models
    // and ONNX runtimes that take 5-20s on first call, causing timeout
    // failures in guidance-provider and reasoningbank tests.
    testTimeout: 30000,
    hookTimeout: 30000,

    // Reporter configuration
    reporters: ['default'],

    // Pool configuration (Vitest 4: poolOptions removed, options are top-level)
    pool: 'threads',

    // Top-level isolate (replaces poolOptions.threads.isolate)
    isolate: true,

    // Per-file pool override: tests that need process.chdir() must run
    // in a forked subprocess (Node's worker threads forbid chdir).
    // Note: poolMatchGlobs is experimental in Vitest 4
    poolMatchGlobs: [
      ['**/router-bandit.test.ts', 'forks'],
    ],

    // Globals for easier testing
    globals: true,

    // Type checking disabled
    typecheck: {
      enabled: false,
    },
  },
});
