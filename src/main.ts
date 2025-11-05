#!/usr/bin/env -S deno run --allow-env --allow-net --allow-read

/**
 * NoMerge GitHub Action
 *
 * This action prevents PR merges when forbidden text patterns are found in:
 * 1. Any file in the PR branch
 * 2. The PR description on GitHub
 *
 * By default, it searches for "nomerge" (case-insensitive).
 * Patterns can be customized via .nomerge.config.json in the repo root.
 */

// ============================================================================
// Types and Interfaces
// ============================================================================

interface PullRequestEvent {
  pull_request: {
    number: number;
    title: string;
    body: string | null;
    head: {
      ref: string;
      sha: string;
    };
    base: {
      ref: string;
    };
  };
  repository: {
    name: string;
    owner: {
      login: string;
    };
  };
}

interface GitHubFile {
  filename: string;
  status: string;
  sha: string;
  blob_url: string;
  contents_url: string;
}

interface CheckResult {
  passed: boolean;
  foundInDescription: boolean;
  foundInFiles: string[];
  message: string;
}

interface NoMergeConfig {
  nomerge?: string | string[];
  caseSensitive?: boolean;
}

// ============================================================================
// GitHub API Client
// ============================================================================

class GitHubClient {
  private token: string;
  private baseUrl = "https://api.github.com";

  constructor(token: string) {
    this.token = token;
  }

  private async request<T>(endpoint: string): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "NoMerge-Action",
      },
    });

    if (!response.ok) {
      throw new Error(
        `GitHub API request failed: ${response.status} ${response.statusText}`
      );
    }

    return await response.json();
  }

  async getPullRequest(owner: string, repo: string, prNumber: number) {
    return await this.request(`/repos/${owner}/${repo}/pulls/${prNumber}`);
  }

  async getPullRequestFiles(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<GitHubFile[]> {
    // Handle pagination
    const files: GitHubFile[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const pageFiles = await this.request<GitHubFile[]>(
        `/repos/${owner}/${repo}/pulls/${prNumber}/files?per_page=${perPage}&page=${page}`
      );

      files.push(...pageFiles);

      if (pageFiles.length < perPage) {
        break; // Last page
      }
      page++;
    }

    return files;
  }

  async getFileContent(
    owner: string,
    repo: string,
    path: string,
    ref: string
  ): Promise<string> {
    const response = await this.request<{
      content: string;
      encoding: string;
    }>(`/repos/${owner}/${repo}/contents/${path}?ref=${ref}`);

    if (response.encoding === "base64") {
      return atob(response.content);
    }

    return response.content;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse the GitHub event payload
 */
async function parseGitHubEvent(
  eventPath: string
): Promise<PullRequestEvent> {
  const eventData = await Deno.readTextFile(eventPath);
  return JSON.parse(eventData);
}

/**
 * Load configuration from .nomerge.config.json
 * Returns default config if file doesn't exist
 */
async function loadConfig(
  client: GitHubClient,
  owner: string,
  repo: string,
  ref: string
): Promise<NoMergeConfig> {
  const defaultConfig: NoMergeConfig = {
    nomerge: "nomerge",
    caseSensitive: false,
  };

  try {
    const configContent = await client.getFileContent(
      owner,
      repo,
      ".nomerge.config.json",
      ref
    );
    const config = JSON.parse(configContent) as NoMergeConfig;

    // Merge with defaults
    return {
      nomerge: config.nomerge ?? defaultConfig.nomerge,
      caseSensitive: config.caseSensitive ?? defaultConfig.caseSensitive,
    };
  } catch (_error) {
    // Config file doesn't exist or can't be read - use defaults
    console.log("  ℹ️  No .nomerge.config.json found, using default pattern: 'nomerge'");
    return defaultConfig;
  }
}

/**
 * Check if text contains any of the forbidden patterns
 */
function containsPattern(
  text: string,
  patterns: string[],
  caseSensitive: boolean
): boolean {
  for (const pattern of patterns) {
    const flags = caseSensitive ? "g" : "gi";
    const regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), flags);
    if (regex.test(text)) {
      return true;
    }
  }
  return false;
}

/**
 * Check PR description for forbidden patterns
 */
function checkDescription(
  description: string | null,
  patterns: string[],
  caseSensitive: boolean
): boolean {
  if (!description) {
    return false;
  }
  return containsPattern(description, patterns, caseSensitive);
}

/**
 * Check files for forbidden patterns
 */
async function checkFiles(
  client: GitHubClient,
  owner: string,
  repo: string,
  ref: string,
  files: GitHubFile[],
  patterns: string[],
  caseSensitive: boolean
): Promise<string[]> {
  const filesWithPattern: string[] = [];
  const patternDisplay = patterns.length === 1 ? `"${patterns[0]}"` : `[${patterns.map((p) => `"${p}"`).join(", ")}]`;

  console.log(`\n📁 Checking ${files.length} files for forbidden pattern(s): ${patternDisplay}`);

  for (const file of files) {
    // Skip deleted files
    if (file.status === "removed") {
      console.log(`  ⏭️  Skipping deleted file: ${file.filename}`);
      continue;
    }

    // Skip the config file itself to avoid recursive issues
    if (file.filename === ".nomerge.config.json") {
      console.log(`  ⏭️  Skipping config file: ${file.filename}`);
      continue;
    }

    try {
      console.log(`  🔍 Checking: ${file.filename}`);
      const content = await client.getFileContent(owner, repo, file.filename, ref);

      if (containsPattern(content, patterns, caseSensitive)) {
        console.log(`  ⚠️  Found forbidden pattern in: ${file.filename}`);
        filesWithPattern.push(file.filename);
      } else {
        console.log(`  ✅ Clean: ${file.filename}`);
      }
    } catch (error) {
      // Handle binary files or files that can't be read as text
      console.log(`  ⚠️  Could not check file (possibly binary): ${file.filename}`);
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`     Error: ${errorMessage}`);
    }
  }

  return filesWithPattern;
}

// ============================================================================
// Main Logic
// ============================================================================

async function runNoMergeCheck(): Promise<CheckResult> {
  // Get environment variables
  const githubToken = Deno.env.get("GITHUB_TOKEN");
  const eventPath = Deno.env.get("GITHUB_EVENT_PATH");
  const repository = Deno.env.get("GITHUB_REPOSITORY");

  if (!githubToken) {
    throw new Error("GITHUB_TOKEN is required");
  }

  if (!eventPath) {
    throw new Error("GITHUB_EVENT_PATH is required (not running in GitHub Actions?)");
  }

  if (!repository) {
    throw new Error("GITHUB_REPOSITORY is required");
  }

  // Parse repository owner and name
  const [owner, repo] = repository.split("/");

  // Parse the event payload
  console.log("\n📋 Parsing GitHub event...");
  const event = await parseGitHubEvent(eventPath);
  const pr = event.pull_request;

  console.log(`\n✅ Pull Request #${pr.number}: ${pr.title}`);
  console.log(`   Branch: ${pr.head.ref} -> ${pr.base.ref}`);
  console.log(`   SHA: ${pr.head.sha}`);

  // Create GitHub client
  const client = new GitHubClient(githubToken);

  // Load configuration
  console.log("\n⚙️  Loading configuration...");
  const config = await loadConfig(client, owner, repo, pr.head.sha);

  // Convert config.nomerge to array
  const patterns = Array.isArray(config.nomerge)
    ? config.nomerge
    : [config.nomerge ?? "nomerge"];
  const caseSensitive = config.caseSensitive ?? false;

  console.log(`  Forbidden patterns: ${patterns.map((p) => `"${p}"`).join(", ")}`);
  console.log(`  Case sensitive: ${caseSensitive}`);

  // Check PR description
  console.log("\n📝 Checking PR description...");
  const foundInDescription = checkDescription(pr.body, patterns, caseSensitive);

  if (foundInDescription) {
    console.log("  ⚠️  Found forbidden pattern in PR description!");
  } else {
    console.log("  ✅ PR description is clean");
  }

  // Get changed files
  console.log("\n📂 Fetching changed files from GitHub API...");
  const files = await client.getPullRequestFiles(owner, repo, pr.number);
  console.log(`  Found ${files.length} changed files`);

  // Check files
  const foundInFiles = await checkFiles(
    client,
    owner,
    repo,
    pr.head.sha,
    files,
    patterns,
    caseSensitive
  );

  // Determine result
  const passed = !foundInDescription && foundInFiles.length === 0;

  // Build message
  const patternDisplay = patterns.length === 1 ? `"${patterns[0]}"` : `patterns: ${patterns.map((p) => `"${p}"`).join(", ")}`;
  let message = "";
  if (passed) {
    message = `✅ No forbidden patterns found. PR is ready to merge!`;
  } else {
    message = `❌ Found forbidden ${patternDisplay} - PR cannot be merged:\n`;
    if (foundInDescription) {
      message += "  - PR description contains forbidden pattern\n";
    }
    if (foundInFiles.length > 0) {
      message += `  - ${foundInFiles.length} file(s) contain forbidden pattern:\n`;
      foundInFiles.forEach((file) => {
        message += `    • ${file}\n`;
      });
    }
  }

  return {
    passed,
    foundInDescription,
    foundInFiles,
    message,
  };
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  console.log("🚀 NoMerge Action Starting...");
  console.log("=".repeat(50));

  try {
    const result = await runNoMergeCheck();

    console.log("\n" + "=".repeat(50));
    console.log("📊 RESULTS");
    console.log("=".repeat(50));
    console.log(result.message);
    console.log("=".repeat(50));

    if (!result.passed) {
      console.log("\n💡 To allow this PR to merge, remove forbidden patterns from:");
      if (result.foundInDescription) {
        console.log("  - The PR description");
      }
      if (result.foundInFiles.length > 0) {
        console.log("  - The files listed above");
      }
      console.log("\n📝 You can customize patterns via .nomerge.config.json in your repo");
      Deno.exit(1);
    }

    console.log("\n🎉 Check passed! This PR can be merged.");
    Deno.exit(0);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("\n❌ Fatal error:", errorMessage);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    Deno.exit(1);
  }
}

// Run the main function
if (import.meta.main) {
  main();
}
