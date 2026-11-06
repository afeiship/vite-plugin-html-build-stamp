# vite-plugin-html-build-stamp
> Inject lightweight build stamp comment into html for vite app.

[![version][version-image]][version-url]
[![license][license-image]][license-url]
[![size][size-image]][size-url]
[![download][download-image]][download-url]

## installation
```shell
npm install @jswork/vite-plugin-html-build-stamp
```

## usage
```ts
import { defineConfig } from 'vite';
import plugin from '@jswork/vite-plugin-html-build-stamp';

export default defineConfig({
  plugins: [plugin()],
});
```

Injected comment (top of index.html, build only by default):

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

## license
Code released under [the MIT license](https://github.com/afeiship/vite-plugin-html-build-stamp/blob/main/LICENSE.txt).

[version-image]: https://img.shields.io/npm/v/@jswork/vite-plugin-html-build-stamp
[version-url]: https://npmjs.org/package/@jswork/vite-plugin-html-build-stamp

[license-image]: https://img.shields.io/npm/l/@jswork/vite-plugin-html-build-stamp
[license-url]: https://github.com/afeiship/vite-plugin-html-build-stamp/blob/main/LICENSE.txt

[size-image]: https://img.shields.io/bundlephobia/minzip/@jswork/vite-plugin-html-build-stamp
[size-url]: https://github.com/afeiship/vite-plugin-html-build-stamp/blob/main/dist/index.min.js

[download-image]: https://img.shields.io/npm/dm/@jswork/vite-plugin-html-build-stamp
[download-url]: https://www.npmjs.com/package/@jswork/vite-plugin-html-build-stamp
