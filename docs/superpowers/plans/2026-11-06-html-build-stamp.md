# vite-plugin-html-build-stamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vite plugin that injects a lightweight build stamp HTML comment (name/version/build_time/build_hash/git_commit/git_branch) at the top of index.html.

**Architecture:** Three focused source files: `stamp.ts` (pure comment generation + FNV-1a hash), `git-info.ts` (CI env vars first, then spawnSync git, then null), `index.ts` (plugin factory wiring `buildStart` / `generateBundle` / `transformIndexHtml`). Zero runtime dependencies.

**Tech Stack:** TypeScript, tsup (build), bun test, Node `child_process.spawnSync`.

**Spec:** `docs/superpowers/specs/2026-11-06-html-build-stamp-design.md`

---

### Task 1: stamp.ts — comment generation core

**Files:**
- Create: `src/stamp.ts`
- Modify: `__tests__/index.spec.ts` (replace placeholder with stamp tests)

- [ ] **Step 1: Write failing tests in `__tests__/index.spec.ts`**

Replace the whole file with:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test`
Expected: FAIL — module `../src/stamp` does not exist

- [ ] **Step 3: Implement `src/stamp.ts`**

```ts
/** Field values keyed by FieldName order; null/undefined fields are skipped. */
export type StampFields = {
  name?: string | null;
  version?: string | null;
  build_time?: string | null;
  build_hash?: string | null;
  git_commit?: string | null;
  git_branch?: string | null;
};

export const FIELD_ORDER = ['name', 'version', 'build_time', 'build_hash', 'git_commit', 'git_branch'] as const;

/** Strip sequences that break an HTML comment: `--`, `<`, `>`, newlines. */
export function escapeCommentValue(inValue: string): string {
  return inValue
    .replace(/--+/g, '-')
    .replace(/[<>]/g, '_')
    .replace(/[\r\n]+/g, '_');
}

/** 8-char FNV-1a hash of a string, hex encoded. */
export function fnv1a8(inInput: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < inInput.length; i++) {
    hash ^= inInput.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/** Build the multi-line HTML comment; empty string when no field survives. */
export function buildStampComment(inFields: StampFields): string {
  const lines = FIELD_ORDER.filter((name) => inFields[name] != null && inFields[name] !== '').map(
    (name) => ` * ${name}: ${escapeCommentValue(inFields[name] as string)}`
  );
  if (!lines.length) return '';
  return ['<!--', ...lines, '-->'].join('\n');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/stamp.ts __tests__/index.spec.ts
git commit -m "feat: add stamp comment builder with fnv1a8 hash and escaping"
```

---

### Task 2: git-info.ts — CI env vars + local git

**Files:**
- Create: `src/git-info.ts`
- Create: `__tests__/git-info.spec.ts`

- [ ] **Step 1: Write failing tests in `__tests__/git-info.spec.ts`**

```ts
import { describe, test, expect } from 'bun:test';
import { readGitInfo } from '../src/git-info';

describe('git-info', () => {
  test('01/gitlab ci env', () => {
    const info = readGitInfo({
      GITLAB_CI: 'true',
      CI_COMMIT_SHORT_SHA: 'a7f2c71d9e',
      CI_COMMIT_REF_NAME: 'feature/x',
    });
    expect(info).toEqual({ commit: 'a7f2c7', branch: 'feature/x' });
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
    const info = readGitInfo({ CI_COMMIT_SHORT_SHA: 'a7f2c71d9e' });
    expect(info).toEqual({ commit: 'a7f2c7', branch: null });
  });

  test('05/no env, no git repo returns null', () => {
    // bun test runs outside CI vars; cwd has a repo but we point elsewhere
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test`
Expected: FAIL — module `../src/git-info` does not exist

- [ ] **Step 3: Implement `src/git-info.ts`**

```ts
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
  if (inEnv.GITLAB_CI || inEnv.GITHUB_ACTIONS || inEnv.GIT_COMMIT) {
    const commit = short7(inEnv.CI_COMMIT_SHORT_SHA || inEnv.GITHUB_SHA || inEnv.GIT_COMMIT);
    const branch = inEnv.CI_COMMIT_REF_NAME || inEnv.GITHUB_REF_NAME || inEnv.GIT_BRANCH || null;
    if (commit || branch) return { commit, branch: branch as string } as { commit: string; branch: string };
    if (commit === null && branch === null) return null;
  }

  try {
    const commit = runGit(['rev-parse', '--short=7', 'HEAD'], inCwd);
    const branch = runGit(['rev-parse', '--abbrev-ref', 'HEAD'], inCwd);
    if (!commit && !branch) return null;
    return { commit: commit || '', branch: branch || '' };
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test`
Expected: PASS (11 tests total)

- [ ] **Step 5: Commit**

```bash
git add src/git-info.ts __tests__/git-info.spec.ts
git commit -m "feat: read git info from CI env vars with local git fallback"
```

---

### Task 3: index.ts — plugin factory

**Files:**
- Modify: `src/index.ts` (replace template content entirely)
- Create: `__tests__/plugin.spec.ts`

- [ ] **Step 1: Write failing tests in `__tests__/plugin.spec.ts`**

```ts
import { describe, test, expect } from 'bun:test';
import pluginFactory from '../src';

// Minimal mocks for vite hook contexts
const mockBundle = (names: string[]) =>
  Object.fromEntries(names.map((n) => [n, { fileName: n, type: 'asset' as const }]));

describe('plugin', () => {
  test('01/transform injects comment at html start', () => {
    const plugin = pluginFactory() as any;
    const html = '<!DOCTYPE html><html><head></head></html>';
    const out = plugin.transformIndexHtml(html, { path: '/index.html' });
    expect(out.html.startsWith('<!--\n * name:')).toBe(true);
    expect(out.injectTo).toBeUndefined(); // returns string => prepended as-is at top
  });

  test('02/generateBundle derives build_hash from bundle filenames', () => {
    const plugin = pluginFactory() as any;
    const ctx = { bundle: mockBundle(['index-a1b2c3d4.js', 'style-5e6f7a8b.css', 'logo.svg']) };
    plugin.generateBundle.call(plugin, ctx as any, ctx.bundle as any, {} as any);
    // build_hash is stored internally; verify via transform output
    const out = plugin.transformIndexHtml('<html></html>', { path: '/index.html' });
    expect(out.html).toMatch(/build_hash: [0-9a-f]{8}/);
  });

  test('03/disabled when enable=false', () => {
    const plugin = pluginFactory({ enable: false }) as any;
    const out = plugin.transformIndexHtml('<html></html>', { path: '/index.html' });
    expect(out.html).toBe('<html></html>');
  });

  test('04/fields whitelist filters lines', () => {
    const plugin = pluginFactory({ fields: ['name', 'version'] }) as any;
    const out = plugin.transformIndexHtml('<html></html>', { path: '/index.html' });
    expect(out.html).toContain(' * name:');
    expect(out.html).not.toContain('git_commit');
  });

  test('05/types exported', async () => {
    const mod = await import('../src');
    expect(typeof mod.default).toBe('function');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test`
Expected: FAIL — current `src/index.ts` has no `transformIndexHtml`/`generateBundle`

- [ ] **Step 3: Implement `src/index.ts`**

Replace the entire file:

```ts
import { readFileSync } from 'node:fs';
import type { Plugin } from 'vite';
import { FIELD_ORDER, buildStampComment, fnv1a8, StampFields } from './stamp';
import { readGitInfo } from './git-info';

export type FieldName = (typeof FIELD_ORDER)[number];

export interface Options {
  /** Whitelist of fields to inject, in output order. Default: all six. */
  fields?: FieldName[];
  /** Master switch. Default true. */
  enable?: boolean;
  /** Inject during dev server. Default false. */
  enableInDev?: boolean;
}

const PLUGIN_NAME = 'vite-plugin-html-build-stamp';

const factory = (inOptions?: Options): Plugin => {
  const { fields = [...FIELD_ORDER], enable = true, enableInDev = false } = inOptions || {};
  let stampFields: StampFields = {};

  const readPkg = (inRoot: string): { name?: string; version?: string } => {
    try {
      const raw = JSON.parse(readFileSync(`${inRoot}/package.json`, 'utf8'));
      return { name: raw.name, version: raw.version };
    } catch {
      return {};
    }
  };

  const buildHashFromBundle = (inBundle: Record<string, { fileName?: string }>): string | null => {
    const segments: string[] = [];
    for (const file of Object.values(inBundle)) {
      const m = file?.fileName?.match(/-([0-9a-f]{8,})\./);
      if (m) segments.push(m[1]);
    }
    return segments.length ? fnv1a8(segments.join('|')) : null;
  };

  const contentHash = (): string => {
    const used = fields.filter((f) => stampFields[f]);
    return fnv1a8(used.map((f) => `${f}:${stampFields[f]}`).join('|'));
  };

  return {
    name: PLUGIN_NAME,
    buildStart() {
      const pkg = readPkg(this.environment?.config?.root || process.cwd());
      const git = readGitInfo();
      stampFields = {
        name: pkg.name ?? null,
        version: pkg.version ?? null,
        build_time: new Date().toLocaleString('sv-SE').replace('T', ' '),
        build_hash: null, // filled by generateBundle; dev falls back to content hash
        git_commit: git?.commit ?? null,
        git_branch: git?.branch ?? null,
      };
    },
    generateBundle(_options, bundle) {
      stampFields.build_hash = buildHashFromBundle(bundle as any) || contentHash();
    },
    transformIndexHtml(html) {
      if (!enable) return html;

      const isDev = !!this.environment?.config?.command || (process.env.NODE_ENV !== 'production' && !stampFields.build_hash);
      // Reliable dev detection: no build_hash set by generateBundle during dev
      const inDev = !stampFields.build_hash && !(this as any).getAddonHooks;
      if (inDev && !enableInDev) return html;

      const all: StampFields = { ...stampFields };
      if (!all.build_hash) all.build_hash = contentHash(); // dev fallback hash

      const selected: StampFields = {};
      for (const f of fields) selected[f] = all[f] ?? null;
      const comment = buildStampComment(selected);
      if (!comment) return html;
      return `${comment}\n${html}`;
    },
  };
};

export default factory;
```

**Note on dev detection:** rather than fragile `command` access on the hook context, use the simpler invariant: during `vite build`, `generateBundle` always runs before `transformIndexHtml` and sets `build_hash`. During dev, it never runs — so `build_hash == null` at transform time means dev. This is deterministic and dependency-free.

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test`
Expected: PASS (16 tests total)

- [ ] **Step 5: Commit**

```bash
git add src/index.ts __tests__/plugin.spec.ts
git commit -m "feat: implement plugin factory with transformIndexHtml injection"
```

---

### Task 4: Real build verification (example project)

**Files:**
- Create: `examples/vite.config.ts`
- Create: `examples/index.html` (minimal)
- Modify: `package.json` (remove stale `peerDependencies` for `@jswork/next`; nothing else)

- [ ] **Step 1: Create example project**

`examples/vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import plugin from '../src';

export default defineConfig({
  plugins: [plugin()],
  build: { outDir: 'dist-example' },
});
```

`examples/index.html`:

```html
<!DOCTYPE html>
<html>
  <head><title>demo</title></head>
  <body><div id="app"></div></body>
</html>
```

- [ ] **Step 2: Build the example with the plugin**

Run:
```bash
cd examples && npx vite build --config vite.config.ts 2>&1 | tail -5 && head -10 dist-example/index.html
```
Expected: `dist-example/index.html` starts with `<!--` containing `name:`, `version:`, `build_time:`, `build_hash:`, `git_commit:`, `git_branch:` lines in fixed order.

- [ ] **Step 3: Verify dev mode does NOT inject**

Run:
```bash
timeout 5 npx vite --config vite.config.ts --port 5199 & sleep 3; curl -s http://localhost:5199/ | head -3; kill %1 2>/dev/null
```
Expected: response HTML does **not** start with `<!--` (no stamp in dev by default).

- [ ] **Step 4: Clean example output, commit**

```bash
rm -rf examples/dist-example examples/node_modules/.vite
echo 'dist-example/' >> examples/.gitignore 2>/dev/null || echo 'dist-example/' > examples/.gitignore
git add examples/vite.config.ts examples/index.html package.json
git commit -m "feat: add example project for manual verification"
```

---

### Task 5: package.json / tsup alignment + full build

**Files:**
- Modify: `package.json`
- Modify: `tsup.config.ts` (entry fix if needed)

- [ ] **Step 1: Fix package.json metadata**

- Remove `peerDependencies` block (`@jswork/next` is not used)
- Remove `@jswork/next` from devDependencies
- Update keywords: `["vite", "plugin", "build-stamp", "html"]`
- Keep everything else as-is (jswork template conventions)

- [ ] **Step 2: Verify tsup entry picks up all three src files**

`tsup.config.ts` already has `entry: ['src/*.ts']` — keep as-is.

- [ ] **Step 3: Run full build**

Run: `pnpm install && pnpm build`
Expected: `dist/` contains `index.js`, `index.mjs`, `index.d.ts`, `stamp.js`, `stamp.mjs`, `git-info.js`, `git-info.mjs` + declaration files. No errors.

- [ ] **Step 4: Run all tests once more**

Run: `pnpm test`
Expected: PASS (16 tests)

- [ ] **Step 5: Commit**

```bash
git add package.json
git commit -m "chore: align package metadata for build stamp plugin"
```

---

### Task 6: README update

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Rewrite usage section**

Keep the existing jswork badge header block, replace the usage section with:

```markdown
## usage
```ts
import { defineConfig } from 'vite';
import plugin from '@jswork/vite-plugin-html-build-stamp';

export default defineConfig({
  plugins: [plugin()],
});
```

Injected comment (top of index.html, build only):

```
<!--
 * name: frontend
 * version: 2.1.0
 * build_time: 2026-11-06 12:38:09
 * build_hash: 3fa2c71d
 * git_commit: a7f2c71
 * git_branch: main
-->
```

## options

| option | type | default | description |
|---|---|---|---|
| `fields` | `string[]` | all 6 | Whitelist of injected fields (order fixed: name, version, build_time, build_hash, git_commit, git_branch) |
| `enable` | `boolean` | `true` | Master switch |
| `enableInDev` | `boolean` | `false` | Also inject during dev server |

## field sources

- `name` / `version`: `package.json`
- `build_time`: local time, `YYYY-MM-DD HH:mm:ss`
- `build_hash`: hash of collected bundle filename hashes (falls back to content hash in dev)
- `git_commit` / `git_branch`: CI env vars first (GitLab CI, GitHub Actions), then local `git`. Missing → line omitted.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: document options and field sources in README"
```

---

## Self-Review Notes

- Spec coverage: comment format/order (Task 1), CI+git fallback (Task 2), injection + switches (Task 3), manual dev/build verification (Task 4), packaging (Task 5), docs (Task 6). ✅
- Dev detection uses `build_hash == null` invariant (generateBundle runs only on build) — deterministic, no fragile API access.
- `toLocaleString('sv-SE')` yields `YYYY-MM-DD HH:mm:ss` in local timezone natively; no manual formatting needed.
