import { describe, test, expect } from 'bun:test';
import { readGitInfo } from '../src/git-info';

describe('git-info', () => {
  test('01/gitlab ci env', () => {
    const info = readGitInfo({
      GITLAB_CI: 'true',
      CI_COMMIT_SHORT_SHA: 'a7f2c71d9e',
      CI_COMMIT_REF_NAME: 'feature/x',
    });
    expect(info).toEqual({ commit: 'a7f2c71', branch: 'feature/x' });
  });

  test('02/github actions env', () => {
    const info = readGitInfo({
      GITHUB_ACTIONS: 'true',
      GITHUB_SHA: '0123456789abcdef',
      GITHUB_REF_NAME: 'main',
    });
    expect(info).toEqual({ commit: '0123456', branch: 'main' });
  });

  test('03/generic env fallback', () => {
    const info = readGitInfo({ GIT_COMMIT: 'ffffffff1', GIT_BRANCH: 'dev' });
    expect(info).toEqual({ commit: 'fffffff', branch: 'dev' });
  });

  test('04/partial env yields partial result', () => {
    const info = readGitInfo({ CI_COMMIT_SHORT_SHA: 'a7f2c71d9e' }, '/nonexistent-dir-for-test');
    expect(info).toEqual({ commit: 'a7f2c71', branch: null });
  });

  test('05/no env, no git repo returns null', () => {
    const info = readGitInfo({}, '/nonexistent-dir-for-test');
    expect(info).toBeNull();
  });

  test('06/real repo resolves in this project', () => {
    const info = readGitInfo({}, process.cwd());
    expect(info).not.toBeNull();
    expect(info!.commit).toMatch(/^[0-9a-f]{7}$/);
    expect(info!.branch).toBeTruthy();
  });
});
