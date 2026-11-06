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
    expect(out.injectTo).toBeUndefined();
  });

  test('02/generateBundle derives build_hash from bundle filenames', () => {
    const plugin = pluginFactory() as any;
    const ctx = { bundle: mockBundle(['index-a1b2c3d4.js', 'style-5e6f7a8b.css', 'logo.svg']) };
    plugin.generateBundle.call(plugin, ctx as any, ctx.bundle as any, {} as any);
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
