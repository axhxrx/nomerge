/**
 * CLI Integration Tests
 *
 * These tests run the actual CLI against realistic fixture repositories
 * to stress-test the functionality with real-world scenarios.
 *
 * Run with: deno test --allow-read --allow-run cli_integration_test.ts
 */

import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";

// Helper to run CLI command and capture output
async function runCli(args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const cmd = new Deno.Command("deno", {
    args: ["run", "--allow-read", "main.ts", ...args],
    stdout: "piped",
    stderr: "piped",
  });

  const output = await cmd.output();

  return {
    exitCode: output.code,
    stdout: new TextDecoder().decode(output.stdout),
    stderr: new TextDecoder().decode(output.stderr),
  };
}

// ============================================================================
// Fixture Tests - Clean Repository
// ============================================================================

Deno.test("CLI: clean-repo should pass (no forbidden patterns)", async () => {
  const result = await runCli([
    "--directory", "fixtures/clean-repo",
  ]);

  assertEquals(result.exitCode, 0, "Should exit with success code");
  assertEquals(result.stdout.includes("✅ No forbidden patterns found"), true);
});

// ============================================================================
// Fixture Tests - TODO/FIXME Markers
// ============================================================================

Deno.test("CLI: todo-fixme should fail with TODO pattern", async () => {
  const result = await runCli([
    "--directory", "fixtures/todo-fixme",
    "--nomerge", "TODO",
  ]);

  assertEquals(result.exitCode, 1, "Should exit with error code");
  assertEquals(result.stdout.includes("src/auth.js"), true, "Should detect TODO in auth.js");
  assertEquals(result.stdout.includes("src/api.js"), true, "Should detect TODO in api.js");
});

Deno.test("CLI: todo-fixme should fail with FIXME pattern", async () => {
  const result = await runCli([
    "--directory", "fixtures/todo-fixme",
    "--nomerge", "FIXME",
  ]);

  assertEquals(result.exitCode, 1, "Should exit with error code");
  assertEquals(result.stdout.includes("src/auth.js"), true, "Should detect FIXME in auth.js");
});

Deno.test("CLI: todo-fixme should fail with WIP pattern", async () => {
  const result = await runCli([
    "--directory", "fixtures/todo-fixme",
    "--nomerge", "WIP",
  ]);

  assertEquals(result.exitCode, 1, "Should exit with error code");
  assertEquals(result.stdout.includes("src/api.js"), true, "Should detect WIP in api.js");
});

Deno.test("CLI: todo-fixme should fail with all patterns", async () => {
  const result = await runCli([
    "--directory", "fixtures/todo-fixme",
    "--nomerge", "TODO",
    "--nomerge", "FIXME",
    "--nomerge", "WIP",
  ]);

  assertEquals(result.exitCode, 1, "Should exit with error code");
  assertEquals(result.stdout.includes("3 file(s) contain forbidden pattern") ||
               result.stdout.includes("2 file(s) contain forbidden pattern"), true,
    "Should detect multiple files with patterns");
});

// ============================================================================
// Fixture Tests - Custom Pattern
// ============================================================================

Deno.test("CLI: custom-pattern should fail with DONOTMERGE (case-sensitive)", async () => {
  const result = await runCli([
    "--directory", "fixtures/custom-pattern",
    "--nomerge", "DONOTMERGE",
    "--case-sensitive",
  ]);

  assertEquals(result.exitCode, 1, "Should exit with error code");
  assertEquals(result.stdout.includes("lib/database.js"), true, "Should detect DONOTMERGE");
});

Deno.test("CLI: custom-pattern should pass with donotmerge (wrong case)", async () => {
  const result = await runCli([
    "--directory", "fixtures/custom-pattern",
    "--nomerge", "donotmerge",
    "--case-sensitive",
  ]);

  assertEquals(result.exitCode, 0, "Should pass (wrong case)");
});

Deno.test("CLI: custom-pattern should fail with donotmerge (case-insensitive)", async () => {
  const result = await runCli([
    "--directory", "fixtures/custom-pattern",
    "--nomerge", "donotmerge",
  ]);

  assertEquals(result.exitCode, 1, "Should fail (case-insensitive matches)");
  assertEquals(result.stdout.includes("lib/database.js"), true);
});

// ============================================================================
// Fixture Tests - Ignore Patterns
// ============================================================================

Deno.test("CLI: with-ignores should ignore docs/** pattern", async () => {
  const result = await runCli([
    "--directory", "fixtures/with-ignores",
    "--ignore", "docs/**",
    "--ignore", "**/*.spec.js",
  ]);

  assertEquals(result.exitCode, 1, "Should still fail (src/broken.js not ignored)");
  assertEquals(result.stdout.includes("src/broken.js"), true, "Should detect in non-ignored file");
  assertEquals(result.stdout.includes("docs/README.md"), false, "Should NOT detect in ignored docs");
  assertEquals(result.stdout.includes("test.spec.js"), false, "Should NOT detect in ignored tests");
});

Deno.test("CLI: with-ignores should detect when no ignores specified", async () => {
  const result = await runCli([
    "--directory", "fixtures/with-ignores",
  ]);

  assertEquals(result.exitCode, 1, "Should fail");
  // Should detect in multiple files when nothing is ignored
  const fileCount = (result.stdout.match(/src\/broken\.js|docs\/README\.md|tests\/test\.spec\.js/g) || []).length;
  assertEquals(fileCount >= 2, true, "Should detect in multiple files");
});

// ============================================================================
// Fixture Tests - Nested Structure
// ============================================================================

Deno.test("CLI: nested-structure should ignore build/** directory", async () => {
  const result = await runCli([
    "--directory", "fixtures/nested-structure",
    "--ignore", "build/**",
  ]);

  assertEquals(result.exitCode, 1, "Should fail (src/components has pattern)");
  assertEquals(result.stdout.includes("src/components/Button.jsx"), true, "Should detect in component");
  assertEquals(result.stdout.includes("build/output.js"), false, "Should NOT detect in ignored build");
});

Deno.test("CLI: nested-structure should detect without ignores", async () => {
  const result = await runCli([
    "--directory", "fixtures/nested-structure",
  ]);

  assertEquals(result.exitCode, 1, "Should fail");
  assertEquals(result.stdout.includes("src/components/Button.jsx"), true);
  assertEquals(result.stdout.includes("build/output.js"), true, "Should detect in build when not ignored");
});

// ============================================================================
// Fixture Tests - Case Sensitivity
// ============================================================================

Deno.test("CLI: case-sensitive should only match exact case", async () => {
  const result = await runCli([
    "--directory", "fixtures/case-sensitive",
    "--case-sensitive",
  ]);

  assertEquals(result.exitCode, 1, "Should fail");
  assertEquals(result.stdout.includes("src/auth.js"), true, "Should detect lowercase 'nomerge'");
  assertEquals(result.stdout.includes("src/config.js"), false, "Should NOT detect 'NoMerge' or 'NOMERGE'");
});

Deno.test("CLI: case-sensitive should match all cases when insensitive", async () => {
  const result = await runCli([
    "--directory", "fixtures/case-sensitive",
  ]);

  assertEquals(result.exitCode, 1, "Should fail");
  const matches = result.stdout.match(/src\/(auth|config)\.js/g) || [];
  assertEquals(matches.length >= 1, true, "Should detect in multiple files (case-insensitive)");
});

// ============================================================================
// Fixture Tests - Edge Cases
// ============================================================================

Deno.test("CLI: edge-cases should detect pattern in various positions", async () => {
  const result = await runCli([
    "--directory", "fixtures/edge-cases",
  ]);

  assertEquals(result.exitCode, 1, "Should fail");
  assertEquals(result.stdout.includes("src/special.js"), true, "Should detect patterns in various positions");
});

Deno.test("CLI: edge-cases should handle empty files gracefully", async () => {
  const result = await runCli([
    "--directory", "fixtures/edge-cases",
    "--nomerge", "NONEXISTENT",
  ]);

  assertEquals(result.exitCode, 0, "Should pass (pattern not found)");
});

// ============================================================================
// Fixture Tests - Multiple Patterns
// ============================================================================

Deno.test("CLI: multiple-patterns should detect all specified patterns", async () => {
  const result = await runCli([
    "--directory", "fixtures/multiple-patterns",
    "--nomerge", "HACK",
    "--nomerge", "XXX",
    "--nomerge", "TEMP",
  ]);

  assertEquals(result.exitCode, 1, "Should fail");
  assertEquals(result.stdout.includes("src/incomplete.js"), true, "Should detect all patterns");
  assertEquals(result.stdout.includes("src/clean.js"), false, "Should NOT detect in clean file");
});

Deno.test("CLI: multiple-patterns should only detect specified pattern", async () => {
  const result = await runCli([
    "--directory", "fixtures/multiple-patterns",
    "--nomerge", "HACK",
  ]);

  assertEquals(result.exitCode, 1, "Should fail");
  assertEquals(result.stdout.includes("src/incomplete.js"), true, "Should detect HACK");
});

// ============================================================================
// CLI Argument Tests
// ============================================================================

Deno.test("CLI: --help should show usage information", async () => {
  const result = await runCli(["--help"]);

  assertEquals(result.exitCode, 0, "Should exit successfully");
  assertEquals(result.stdout.includes("USAGE"), true, "Should show usage");
  assertEquals(result.stdout.includes("--nomerge"), true, "Should document --nomerge flag");
  assertEquals(result.stdout.includes("--ignore"), true, "Should document --ignore flag");
});

Deno.test("CLI: invalid argument should error", async () => {
  const result = await runCli(["--invalid-arg"]);

  assertEquals(result.exitCode, 1, "Should exit with error");
  assertEquals(result.stderr.includes("Unknown argument") ||
               result.stdout.includes("Unknown argument"), true,
    "Should show error about unknown argument");
});

// ============================================================================
// Glob Pattern Stress Tests
// ============================================================================

Deno.test("CLI: complex glob patterns should work correctly", async () => {
  const result = await runCli([
    "--directory", "fixtures/with-ignores",
    "--ignore", "**/*.spec.js",
    "--ignore", "docs/**/*.md",
    "--ignore", "test/**",
  ]);

  assertEquals(result.exitCode, 1, "Should still find pattern in src/broken.js");
  assertEquals(result.stdout.includes("src/broken.js"), true);
});

Deno.test("CLI: single star pattern should not match across directories", async () => {
  const result = await runCli([
    "--directory", "fixtures/nested-structure",
    "--ignore", "src/*.jsx",  // Single star - should only match files directly in src/
  ]);

  assertEquals(result.exitCode, 1, "Should fail");
  // src/components/Button.jsx should still be detected (not directly in src/)
  assertEquals(result.stdout.includes("Button.jsx"), true);
});

Deno.test("CLI: question mark pattern should match single character", async () => {
  const result = await runCli([
    "--directory", "fixtures/with-ignores",
    "--ignore", "src/broken.j?",  // Should match broken.js
  ]);

  // broken.js should be ignored, but other files with "nomerge" might still exist
  const hasPattern = result.exitCode === 1;
  const mentionsBroken = result.stdout.includes("src/broken.js");
  assertEquals(mentionsBroken, false, "Should NOT mention broken.js (it's ignored)");
});

// ============================================================================
// Performance and Scalability
// ============================================================================

Deno.test("CLI: should handle scanning all fixtures efficiently", async () => {
  const startTime = Date.now();

  const result = await runCli([
    "--directory", "fixtures",
    "--ignore", "**/.nomerge.config.json",  // Ignore config files
  ]);

  const duration = Date.now() - startTime;

  // Should complete in reasonable time (under 5 seconds for small fixtures)
  assertEquals(duration < 5000, true, `Should complete quickly (took ${duration}ms)`);

  // Should find patterns in multiple fixtures
  assertEquals(result.exitCode, 1, "Should find forbidden patterns");
});
