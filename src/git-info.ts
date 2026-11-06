import { spawnSync } from 'node:child_process';

export type GitInfo = { commit: string; branch: string } | null;

interface GitLikeEnv {
  GITLAB_CI?: string;
  CI_COMMIT_SHORT_SHA?: string;
  CI_COMMIT_REF_NAME?: string;
  GITHUB_ACTIONS?: string;
  GITHUB_SHA?: string;
  GITHUB_REF_NAME?: string;
  GIT_COMMIT?: string;
  GIT_BRANCH?: string;
}

const short7 = (inValue?: string) => (inValue ? inValue.slice(0, 7) : null);

/** CI env vars first (GitLab / GitHub / generic), then local git command. */
export function readGitInfo(inEnv: GitLikeEnv = process.env, inCwd: string = process.cwd()): GitInfo {
  if (
    inEnv.GITLAB_CI ||
    inEnv.GITHUB_ACTIONS ||
    inEnv.GIT_COMMIT ||
    inEnv.CI_COMMIT_SHORT_SHA ||
    inEnv.GITHUB_SHA
  ) {
    const commit = short7(inEnv.CI_COMMIT_SHORT_SHA || inEnv.GITHUB_SHA || inEnv.GIT_COMMIT);
    const branch = inEnv.CI_COMMIT_REF_NAME || inEnv.GITHUB_REF_NAME || inEnv.GIT_BRANCH || null;
    if (!commit && !branch) return null;
    return { commit: commit || null, branch: branch || null } as GitInfo;
  }

  try {
    const commit = runGit(['rev-parse', '--short=7', 'HEAD'], inCwd);
    const branch = runGit(['rev-parse', '--abbrev-ref', 'HEAD'], inCwd);
    if (!commit && !branch) return null;
    return { commit: commit || null, branch: branch || null } as GitInfo;
  } catch {
    return null;
  }
}

function runGit(inArgs: string[], inCwd: string): string | null {
  try {
    const res = spawnSync('git', inArgs, { cwd: inCwd, encoding: 'utf8' });
    if (res.status !== 0 || !res.stdout) return null;
    return res.stdout.trim() || null;
  } catch {
    return null;
  }
}
