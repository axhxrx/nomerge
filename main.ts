#!/usr/bin/env -S deno run --allow-env --allow-net --allow-read

/**
 * NoMerge - Prevent PR merges when forbidden patterns are found
 *
 * Can be used as:
 * 1. GitHub Action (reads from environment variables)
 * 2. CLI tool (reads from command-line arguments)
 *
 * CLI Usage:
 *   deno run --allow-read main.ts --nomerge FIXME --nomerge TODO --ignore "**/*.html"
 *   deno run --allow-read main.ts --help
 *
 * GitHub Actions Usage:
 *   Automatically detects GitHub Actions environment
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
  ignore?: string[];
}

interface CliOptions {
  patterns: string[];
  ignorePatterns: string[];
  caseSensitive: boolean;
  help: boolean;
  directory?: string;
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
 * Parse command-line arguments
 */
export function parseCliArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    patterns: [],
    ignorePatterns: [],
    caseSensitive: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case "--help":
      case "-h":
        options.help = true;
        break;

      case "--nomerge":
      case "-n":
        if (i + 1 < args.length) {
          options.patterns.push(args[++i]);
        } else {
          throw new Error(`${arg} requires a pattern argument`);
        }
        break;

      case "--ignore":
      case "-i":
        if (i + 1 < args.length) {
          options.ignorePatterns.push(args[++i]);
        } else {
          throw new Error(`${arg} requires a pattern argument`);
        }
        break;

      case "--case-sensitive":
      case "-c":
        options.caseSensitive = true;
        break;

      case "--directory":
      case "-d":
        if (i + 1 < args.length) {
          options.directory = args[++i];
        } else {
          throw new Error(`${arg} requires a directory path`);
        }
        break;

      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  // Set defaults if no patterns specified
  if (options.patterns.length === 0 && !options.help) {
    options.patterns = ["nomerge"];
  }

  return options;
}

/**
 * Print CLI help message
 */
export function printHelp(): void {
  console.log(`
NoMerge - Prevent PR merges when forbidden patterns are found

USAGE:
  deno run --allow-read main.ts [OPTIONS]

OPTIONS:
  --nomerge, -n <PATTERN>      Pattern to search for (can be specified multiple times)
                               Default: "nomerge"

  --ignore, -i <PATTERN>       Glob pattern for files to ignore (can be specified multiple times)
                               Examples: "*.html", "src/**/*.test.ts", "README.md"

  --case-sensitive, -c         Enable case-sensitive pattern matching
                               Default: case-insensitive

  --directory, -d <PATH>       Directory to scan (default: current directory)

  --help, -h                   Show this help message

EXAMPLES:
  # Check for default "nomerge" pattern in current directory
  deno run --allow-read main.ts

  # Check for custom patterns
  deno run --allow-read main.ts --nomerge FIXME --nomerge TODO

  # Ignore specific files
  deno run --allow-read main.ts --ignore "*.html" --ignore "test/**"

  # Case-sensitive search
  deno run --allow-read main.ts --nomerge FIXME --case-sensitive

  # Scan a specific directory
  deno run --allow-read main.ts --directory ./src

  # Run from JSR (once published)
  deno run --allow-read https://jsr.io/@axhxrx/nomerge/0.0.1/main.ts --nomerge FIXME

GITHUB ACTIONS:
  When running in GitHub Actions, configuration is automatically loaded from
  environment variables and .nomerge.config.json in the repository root.
`);
}

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
      ignore: config.ignore ?? [],
    };
  } catch (_error) {
    // Config file doesn't exist or can't be read - use defaults
    console.log("  ℹ️  No .nomerge.config.json found, using default pattern: 'nomerge'");
    return defaultConfig;
  }
}

/**
 * Check if a file path matches any of the ignore patterns
 * Supports absolute paths, relative paths, and glob patterns
 */
export function isIgnored(filePath: string, ignorePatterns: string[]): boolean {
  if (ignorePatterns.length === 0) {
    return false;
  }

  // Normalize the file path (remove leading ./ if present)
  const normalizedPath = filePath.startsWith("./") ? filePath.slice(2) : filePath;

  for (const pattern of ignorePatterns) {
    // Normalize the pattern
    const normalizedPattern = pattern.startsWith("./") ? pattern.slice(2) : pattern;

    // Exact match
    if (normalizedPath === normalizedPattern) {
      return true;
    }

    // Simple glob pattern matching
    // Convert glob pattern to regex
    // * matches anything except /
    // ** matches anything including /
    // ? matches any single character except /
    const regexPattern = normalizedPattern
      .replace(/\./g, "\\.")  // Escape literal dots FIRST
      .replace(/\*\*/g, "___DOUBLESTAR___")
      .replace(/\*/g, "[^/]*")
      .replace(/___DOUBLESTAR___/g, ".*")
      .replace(/\?/g, "[^/]");

    const regex = new RegExp(`^${regexPattern}$`);
    if (regex.test(normalizedPath)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if text contains any of the forbidden patterns
 */
export function containsPattern(
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
 * Check files for forbidden patterns (GitHub Actions mode)
 */
async function checkFiles(
  client: GitHubClient,
  owner: string,
  repo: string,
  ref: string,
  files: GitHubFile[],
  patterns: string[],
  caseSensitive: boolean,
  ignorePatterns: string[]
): Promise<string[]> {
  const filesWithPattern: string[] = [];
  const patternDisplay = patterns.length === 1 ? `"${patterns[0]}"` : `[${patterns.map((p) => `"${p}"`).join(", ")}]`;

  console.log(`\n📁 Checking ${files.length} files for forbidden pattern(s): ${patternDisplay}`);
  if (ignorePatterns.length > 0) {
    console.log(`  📋 Ignore patterns: ${ignorePatterns.map((p) => `"${p}"`).join(", ")}`);
  }

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

    // Skip files matching ignore patterns
    if (isIgnored(file.filename, ignorePatterns)) {
      console.log(`  ⏭️  Skipping ignored file: ${file.filename}`);
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

/**
 * Check local files for forbidden patterns (CLI mode)
 */
async function checkLocalFiles(
  directory: string,
  patterns: string[],
  caseSensitive: boolean,
  ignorePatterns: string[]
): Promise<string[]> {
  const filesWithPattern: string[] = [];
  const patternDisplay = patterns.length === 1 ? `"${patterns[0]}"` : `[${patterns.map((p) => `"${p}"`).join(", ")}]`;

  console.log(`\n📁 Scanning directory: ${directory}`);
  console.log(`📋 Forbidden pattern(s): ${patternDisplay}`);
  if (ignorePatterns.length > 0) {
    console.log(`📋 Ignore patterns: ${ignorePatterns.map((p) => `"${p}"`).join(", ")}`);
  }

  // Recursively walk directory
  async function walk(dir: string, baseDir: string) {
    for await (const entry of Deno.readDir(dir)) {
      const fullPath = `${dir}/${entry.name}`;
      const relativePath = fullPath.replace(`${baseDir}/`, "");

      if (entry.isDirectory) {
        // Skip .git and node_modules
        if (entry.name === ".git" || entry.name === "node_modules") {
          continue;
        }
        await walk(fullPath, baseDir);
      } else if (entry.isFile) {
        // Skip .nomerge.config.json
        if (entry.name === ".nomerge.config.json") {
          console.log(`  ⏭️  Skipping config file: ${relativePath}`);
          continue;
        }

        // Check if ignored
        if (isIgnored(relativePath, ignorePatterns)) {
          console.log(`  ⏭️  Skipping ignored file: ${relativePath}`);
          continue;
        }

        try {
          console.log(`  🔍 Checking: ${relativePath}`);
          const content = await Deno.readTextFile(fullPath);

          if (containsPattern(content, patterns, caseSensitive)) {
            console.log(`  ⚠️  Found forbidden pattern in: ${relativePath}`);
            filesWithPattern.push(relativePath);
          } else {
            console.log(`  ✅ Clean: ${relativePath}`);
          }
        } catch (error) {
          // Handle binary files or files that can't be read as text
          console.log(`  ⚠️  Could not check file (possibly binary): ${relativePath}`);
        }
      }
    }
  }

  await walk(directory, directory);
  return filesWithPattern;
}

// ============================================================================
// Main Logic
// ============================================================================

async function runGitHubActionsMode(): Promise<CheckResult> {
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
  const ignorePatterns = config.ignore ?? [];

  console.log(`  Forbidden patterns: ${patterns.map((p) => `"${p}"`).join(", ")}`);
  console.log(`  Case sensitive: ${caseSensitive}`);
  if (ignorePatterns.length > 0) {
    console.log(`  Ignore patterns: ${ignorePatterns.map((p) => `"${p}"`).join(", ")}`);
  }

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
    caseSensitive,
    ignorePatterns
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

async function runCliMode(options: CliOptions): Promise<CheckResult> {
  const directory = options.directory ?? Deno.cwd();
  const patterns = options.patterns;
  const caseSensitive = options.caseSensitive;
  const ignorePatterns = options.ignorePatterns;

  // Check local files
  const foundInFiles = await checkLocalFiles(
    directory,
    patterns,
    caseSensitive,
    ignorePatterns
  );

  // Determine result
  const passed = foundInFiles.length === 0;

  // Build message
  const patternDisplay = patterns.length === 1 ? `"${patterns[0]}"` : `patterns: ${patterns.map((p) => `"${p}"`).join(", ")}`;
  let message = "";
  if (passed) {
    message = `✅ No forbidden patterns found!`;
  } else {
    message = `❌ Found forbidden ${patternDisplay}:\n`;
    message += `  - ${foundInFiles.length} file(s) contain forbidden pattern:\n`;
    foundInFiles.forEach((file) => {
      message += `    • ${file}\n`;
    });
  }

  return {
    passed,
    foundInDescription: false,
    foundInFiles,
    message,
  };
}

/**
 * Main entry point
 */
export async function main(): Promise<void> {
  console.log("🚀 NoMerge Starting...");
  console.log("=".repeat(50));

  try {
    // Check if running in GitHub Actions
    const isGitHubActions = Deno.env.get("GITHUB_ACTIONS") === "true";

    let result: CheckResult;

    if (isGitHubActions) {
      console.log("📦 Running in GitHub Actions mode");
      result = await runGitHubActionsMode();
    } else {
      console.log("💻 Running in CLI mode");

      // Parse CLI arguments
      const args = Deno.args;
      const options = parseCliArgs(args);

      if (options.help) {
        printHelp();
        Deno.exit(0);
      }

      result = await runCliMode(options);
    }

    console.log("\n" + "=".repeat(50));
    console.log("📊 RESULTS");
    console.log("=".repeat(50));
    console.log(result.message);
    console.log("=".repeat(50));

    if (!result.passed) {
      console.log("\n💡 To fix this:");
      if (result.foundInDescription) {
        console.log("  - Remove forbidden patterns from the PR description");
      }
      if (result.foundInFiles.length > 0) {
        console.log("  - Remove forbidden patterns from the files listed above");
        console.log("  - Or add them to the ignore list in .nomerge.config.json");
      }
      Deno.exit(1);
    }

    console.log("\n🎉 Check passed!");
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
