/**
 * NoMerge - Main module entry point
 *
 * This module exports all public functions and types from main.ts
 * and runs the main function when executed directly.
 */

export { main, parseCliArgs, printHelp, isIgnored, containsPattern, findPatternMatches } from "./main.ts";

// Run main() when this module is executed directly
if (import.meta.main) {
  const { main } = await import("./main.ts");
  await main();
}
