import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./test/setup.ts"],
    testTimeout: 15000,
    // Every test file shares one real Postgres database (truncated between
    // tests, schema applied in beforeAll). Vitest's default is to run test
    // files in parallel, which races multiple files' beforeAll/beforeEach
    // against that same database at once — causing duplicate-key errors,
    // deadlocks, and one file's cleanup wiping another's data mid-test.
    // Forcing everything onto a single fork makes test files run one at a
    // time, which is required whenever tests share external state like this.
    fileParallelism: false,
    pool: "forks",
    poolOptions: {
      forks: { singleFork: true },
    },
    env: {
      DATABASE_URL:
        process.env.TEST_DATABASE_URL || "postgres://postgres:testpass@localhost:5432/epc_test",
      JWT_SECRET: "test_secret_do_not_use_in_production",
      ANTHROPIC_API_KEY: "test_key_mocked_in_tests",
    },
  },
});