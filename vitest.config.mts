import { defineConfig } from "vitest/config";
import path from "node:path";

const alias = {
  "@": path.resolve(import.meta.dirname, "src"),
  // "server-only" lança erro fora do servidor React; nos testes é um módulo vazio
  "server-only": path.resolve(import.meta.dirname, "tests/stubs/empty.ts"),
};

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: { name: "unit", include: ["tests/unit/**/*.test.ts"], environment: "node" },
      },
      {
        resolve: { alias },
        test: {
          name: "db",
          include: ["tests/db/**/*.test.ts"],
          environment: "node",
          globalSetup: ["tests/db/global-setup.ts"],
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 120_000,
          env: {
            APP_ENV: "test",
            DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/inova_test",
            AUTH_PROVIDER: "dev",
            DEV_AUTH_SECRET: "test-secret-test-secret-test-secret-123",
            STORAGE_DRIVER: "local",
            EMAIL_PROVIDER: "log",
            WHATSAPP_PROVIDER: "mock",
            META_APP_SECRET: "test-app-secret",
            WHATSAPP_VERIFY_TOKEN: "verify-me",
            OUTBOUND_ALLOWLIST: "cliente@example.com,+351912345678",
            STAFF_NOTIFICATION_EMAILS: "equipa@example.com",
          },
        },
      },
    ],
  },
});
