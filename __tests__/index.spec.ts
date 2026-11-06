import { describe, test, expect } from 'bun:test';
import { buildStampComment, fnv1a8, escapeCommentValue } from '../src/stamp';

describe('stamp', () => {
  const fullFields = {
    name: 'frontend',
    version: '2.1.0',
    build_time: '2026-11-06 12:38:09',
    build_hash: '3fa2c71d',
    git_commit: 'a7f2c71',
    git_branch: 'main',
  };

  test('01/all fields in fixed order', () => {
    const expected = [
      '<!--',
      ' * name: frontend',
      ' * version: 2.1.0',
      ' * build_time: 2026-11-06 12:38:09',
      ' * build_hash: 3fa2c71d',
      ' * git_commit: a7f2c71',
      ' * git_branch: main',
      '-->',
    ].join('\n');
    expect(buildStampComment(fullFields)).toBe(expected);
  });

  test('02/skips missing (null/undefined) lines', () => {
    const comment = buildStampComment({ name: 'app', git_commit: null });
    expect(comment).toBe('<!--\n * name: app\n-->');
  });

  test('03/empty comment when nothing left', () => {
    expect(buildStampComment({ git_branch: undefined })).toBe('');
  });

  test('04/escapes dangerous values', () => {
    expect(escapeCommentValue('feat--<script>\nabc')).toBe('feat-script_abc');
    expect(escapeCommentValue('release/v2.0')).toBe('release/v2.0');
  });

  test('05/fnv1a8 returns 8-char hex', () => {
    const h = fnv1a8('name:app|version:1.0.0');
    expect(h).toMatch(/^[0-9a-f]{8}$/);
    expect(fnv1a8('name:app|version:1.0.0')).toBe(h); // deterministic
    expect(fnv1a8('different')).not.toBe(h);
  });
});
