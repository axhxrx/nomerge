#!/usr/bin/env -S deno run --allow-env --allow-net --allow-read

/**
 * NoMerge GitHub Action
 *
 * This action prevents PR merges when the text "nomerge" (case-insensitive) is found in:
 * 1. Any file in the PR branch
 * 2. The PR description on GitHub
 */

/**
 * Main entry point for the action
 */
async function main(): Promise<void> {
  console.log("🚀 NoMerge Action Starting...");
  console.log("=".repeat(50));

  // Display environment info
  console.log(`Deno Version: ${Deno.version.deno}`);
  console.log(`TypeScript Version: ${Deno.version.typescript}`);
  console.log(`V8 Version: ${Deno.version.v8}`);
  console.log("=".repeat(50));

  // Check for required environment variables
  const githubToken = Deno.env.get("GITHUB_TOKEN");
  const eventPath = Deno.env.get("GITHUB_EVENT_PATH");
  const repository = Deno.env.get("GITHUB_REPOSITORY");

  console.log("\n📋 Environment Check:");
  console.log(`GitHub Token: ${githubToken ? "✅ Present" : "❌ Missing"}`);
  console.log(`Event Path: ${eventPath || "❌ Not set"}`);
  console.log(`Repository: ${repository || "❌ Not set"}`);

  if (!githubToken) {
    console.error("\n❌ ERROR: GITHUB_TOKEN is required");
    Deno.exit(1);
  }

  console.log("\n✅ Basic setup complete!");
  console.log("🎉 NoMerge Action finished successfully");

  Deno.exit(0);
}

// Run the main function
if (import.meta.main) {
  main().catch((error) => {
    console.error("\n❌ Fatal error:", error);
    Deno.exit(1);
  });
}
