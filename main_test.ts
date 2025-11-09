/**
 * Unit tests for NoMerge
 *
 * Run with: deno test
 */

import { assertEquals, assertThrows } from "https://deno.land/std@0.208.0/assert/mod.ts";
import {
  parseCliArgs,
  isIgnored,
  containsPattern,
} from "./main.ts";

// ============================================================================
// parseCliArgs Tests
// ============================================================================

Deno.test("parseCliArgs - default pattern", () => {
  const result = parseCliArgs([]);
  assertEquals(result.patterns, ["nomerge"]);
  assertEquals(result.ignorePatterns, []);
  assertEquals(result.caseSensitive, false);
  assertEquals(result.help, false);
});

Deno.test("parseCliArgs - single pattern", () => {
  const result = parseCliArgs(["--nomerge", "FIXME"]);
  assertEquals(result.patterns, ["FIXME"]);
});

Deno.test("parseCliArgs - multiple patterns", () => {
  const result = parseCliArgs(["--nomerge", "FIXME", "--nomerge", "TODO"]);
  assertEquals(result.patterns, ["FIXME", "TODO"]);
});

Deno.test("parseCliArgs - ignore patterns", () => {
  const result = parseCliArgs(["--ignore", "*.html", "--ignore", "test/**"]);
  assertEquals(result.ignorePatterns, ["*.html", "test/**"]);
  assertEquals(result.patterns, ["nomerge"]); // default
});

Deno.test("parseCliArgs - case sensitive", () => {
  const result = parseCliArgs(["--case-sensitive"]);
  assertEquals(result.caseSensitive, true);
});

Deno.test("parseCliArgs - short flags", () => {
  const result = parseCliArgs(["-n", "FIXME", "-i", "*.md", "-c"]);
  assertEquals(result.patterns, ["FIXME"]);
  assertEquals(result.ignorePatterns, ["*.md"]);
  assertEquals(result.caseSensitive, true);
});

Deno.test("parseCliArgs - help flag", () => {
  const result = parseCliArgs(["--help"]);
  assertEquals(result.help, true);
});

Deno.test("parseCliArgs - directory option", () => {
  const result = parseCliArgs(["--directory", "./src"]);
  assertEquals(result.directory, "./src");
});

Deno.test("parseCliArgs - unknown argument throws error", () => {
  assertThrows(
    () => parseCliArgs(["--unknown"]),
    Error,
    "Unknown argument: --unknown"
  );
});

Deno.test("parseCliArgs - missing pattern value throws error", () => {
  assertThrows(
    () => parseCliArgs(["--nomerge"]),
    Error,
    "--nomerge requires a pattern argument"
  );
});

// ============================================================================
// isIgnored Tests
// ============================================================================

Deno.test("isIgnored - empty patterns returns false", () => {
  assertEquals(isIgnored("file.txt", []), false);
});

Deno.test("isIgnored - exact match", () => {
  assertEquals(isIgnored("README.md", ["README.md"]), true);
  assertEquals(isIgnored("OTHER.md", ["README.md"]), false);
});

Deno.test("isIgnored - exact match with leading ./", () => {
  assertEquals(isIgnored("./README.md", ["README.md"]), true);
  assertEquals(isIgnored("README.md", ["./README.md"]), true);
});

Deno.test("isIgnored - single star pattern", () => {
  assertEquals(isIgnored("test.html", ["*.html"]), true);
  assertEquals(isIgnored("test.js", ["*.html"]), false);
  assertEquals(isIgnored("dir/test.html", ["*.html"]), false); // * doesn't match /
});

Deno.test("isIgnored - double star pattern", () => {
  assertEquals(isIgnored("src/main.ts", ["src/**"]), true);
  assertEquals(isIgnored("src/utils/helper.ts", ["src/**"]), true);
  assertEquals(isIgnored("lib/main.ts", ["src/**"]), false);
});

Deno.test("isIgnored - double star in middle", () => {
  assertEquals(isIgnored("src/test/file.ts", ["src/**/file.ts"]), true);
  assertEquals(isIgnored("src/utils/test/file.ts", ["src/**/file.ts"]), true);
  assertEquals(isIgnored("src/file.ts", ["src/**/file.ts"]), true);
  assertEquals(isIgnored("lib/test/file.ts", ["src/**/file.ts"]), false);
});

Deno.test("isIgnored - question mark pattern", () => {
  assertEquals(isIgnored("test1.md", ["test?.md"]), true);
  assertEquals(isIgnored("test2.md", ["test?.md"]), true);
  assertEquals(isIgnored("test12.md", ["test?.md"]), false);
  assertEquals(isIgnored("test.md", ["test?.md"]), false);
});

Deno.test("isIgnored - complex glob patterns", () => {
  assertEquals(isIgnored("test.spec.ts", ["*.spec.ts"]), true);
  assertEquals(isIgnored("src/utils/test.spec.ts", ["**/*.spec.ts"]), true);
  assertEquals(isIgnored("README.md", ["*.md"]), true);
  assertEquals(isIgnored("docs/README.md", ["docs/*.md"]), true);
});

Deno.test("isIgnored - pattern with dots", () => {
  assertEquals(isIgnored("file.test.ts", ["*.test.ts"]), true);
  assertEquals(isIgnored("file.spec.ts", ["*.test.ts"]), false);
});

Deno.test("isIgnored - multiple patterns", () => {
  const patterns = ["*.html", "*.css", "test/**"];
  assertEquals(isIgnored("index.html", patterns), true);
  assertEquals(isIgnored("style.css", patterns), true);
  assertEquals(isIgnored("test/file.js", patterns), true);
  assertEquals(isIgnored("src/main.ts", patterns), false);
});

// ============================================================================
// containsPattern Tests
// ============================================================================

Deno.test("containsPattern - case insensitive (default)", () => {
  assertEquals(containsPattern("This has NOMERGE", ["nomerge"], false), true);
  assertEquals(containsPattern("This has nomerge", ["nomerge"], false), true);
  assertEquals(containsPattern("This has NoMerge", ["nomerge"], false), true);
  assertEquals(containsPattern("This is clean", ["nomerge"], false), false);
});

Deno.test("containsPattern - case sensitive", () => {
  assertEquals(containsPattern("This has NOMERGE", ["nomerge"], true), false);
  assertEquals(containsPattern("This has nomerge", ["nomerge"], true), true);
  assertEquals(containsPattern("This has NoMerge", ["nomerge"], true), false);
});

Deno.test("containsPattern - multiple patterns", () => {
  const patterns = ["FIXME", "TODO"];
  assertEquals(containsPattern("FIXME: broken", patterns, false), true);
  assertEquals(containsPattern("TODO: implement", patterns, false), true);
  assertEquals(containsPattern("Clean code", patterns, false), false);
});

Deno.test("containsPattern - pattern with special regex characters", () => {
  assertEquals(containsPattern("Price: $10.00", ["$10"], false), true);
  assertEquals(containsPattern("Test (passed)", ["(passed)"], false), true);
  assertEquals(containsPattern("100% complete", ["100%"], false), true);
});

Deno.test("containsPattern - empty pattern list", () => {
  assertEquals(containsPattern("Any text", [], false), false);
});

Deno.test("containsPattern - pattern at start of text", () => {
  assertEquals(containsPattern("FIXME: this is broken", ["FIXME"], false), true);
});

Deno.test("containsPattern - pattern at end of text", () => {
  assertEquals(containsPattern("This needs work FIXME", ["FIXME"], false), true);
});

Deno.test("containsPattern - pattern in middle of word", () => {
  assertEquals(containsPattern("renomergency", ["nomerge"], false), true);
});

Deno.test("containsPattern - multiline text", () => {
  const text = `Line 1
  Line 2 with FIXME
  Line 3`;
  assertEquals(containsPattern(text, ["FIXME"], false), true);
});
