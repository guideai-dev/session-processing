/**
 * Git URL utilities for building GitHub links
 */

/**
 * Extracts owner and repo from various GitHub URL formats
 * Handles both SSH and HTTPS formats:
 * - SSH: git@github.com:owner/repo.git
 * - HTTPS: https://github.com/owner/repo.git
 * - HTTPS (no .git): https://github.com/owner/repo
 */
export function parseGitHubUrl(url: string | null | undefined): { owner: string; repo: string } | null {
  if (!url) return null

  // Try SSH format first: git@github.com:owner/repo.git
  const sshMatch = url.match(/git@github\.com:([^/]+)\/([^/.]+)(\.git)?/)
  if (sshMatch) {
    return {
      owner: sshMatch[1],
      repo: sshMatch[2],
    }
  }

  // Try HTTPS format: https://github.com/owner/repo(.git)?
  const httpsMatch = url.match(/https?:\/\/github\.com\/([^/]+)\/([^/.]+)(\.git)?/)
  if (httpsMatch) {
    return {
      owner: httpsMatch[1],
      repo: httpsMatch[2],
    }
  }

  return null
}

/**
 * Builds a GitHub compare/diff URL for two commits
 * Returns null if unable to build URL (invalid git URL, missing commits, or commits are identical)
 *
 * @param gitRemoteUrl - The Git remote URL (SSH or HTTPS format)
 * @param firstCommit - The first commit hash
 * @param latestCommit - The latest commit hash
 * @returns GitHub compare URL or null
 */
export function buildGitHubDiffUrl(
  gitRemoteUrl: string | null | undefined,
  firstCommit: string | null | undefined,
  latestCommit: string | null | undefined
): string | null {
  // Validate inputs
  if (!gitRemoteUrl || !firstCommit || !latestCommit) return null

  // If commits are the same, no diff to show
  if (firstCommit === latestCommit) return null

  // Parse the GitHub URL to extract owner and repo
  const repoInfo = parseGitHubUrl(gitRemoteUrl)
  if (!repoInfo) return null

  // Build the compare URL
  // GitHub compare syntax: https://github.com/{owner}/{repo}/compare/{base}...{head}
  return `https://github.com/${repoInfo.owner}/${repoInfo.repo}/compare/${firstCommit}...${latestCommit}`
}
