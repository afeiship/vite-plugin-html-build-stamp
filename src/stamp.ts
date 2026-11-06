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
    .replace(/[<>]/g, '')
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
