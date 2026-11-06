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
  let started = false;

  const initFields = (inRoot = process.cwd()) => {
    const pkg = readPkg(inRoot);
    const git = readGitInfo();
    stampFields = {
      name: pkg.name ?? null,
      version: pkg.version ?? null,
      build_time: new Date().toLocaleString('sv-SE').replace('T', ' '),
      build_hash: null,
      git_commit: git?.commit ?? null,
      git_branch: git?.branch ?? null,
    };
  };

  const ensureFields = (inRoot?: string) => {
    if (inRoot || !started) {
      initFields(inRoot);
      started = true;
    }
  };

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
      const root = this.environment?.config?.root || process.cwd();
      ensureFields(root);
    },
    generateBundle(_options, bundle) {
      ensureFields();
      stampFields.build_hash = buildHashFromBundle(bundle as any) || contentHash();
    },
    transformIndexHtml(html, ctx: { server?: unknown } = {}) {
      if (!enable) return { html };

      // Dev detection: the hook context carries `server` only in the dev server.
      if (ctx?.server && !enableInDev) return { html };

      ensureFields();

      const all: StampFields = { ...stampFields };
      if (!all.build_hash) all.build_hash = contentHash();

      const selected: StampFields = {};
      for (const f of fields) selected[f] = all[f] ?? null;
      const comment = buildStampComment(selected);
      if (!comment) return { html };
      return { html: `${comment}\n${html}` };
    },
  };
};

export default factory;
