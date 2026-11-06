import type { Plugin } from 'vite';

interface Options {
  /**
   * The output directory for locales.
   * @default 'public/locales'
   */
  dest?: string;
}

const defaults: Options = {
  dest: 'public/locales',
};

const PLUGIN_NAME = 'vite-plugin-html-build-stamp';
const LOG_PREFIX = `[${PLUGIN_NAME}]`;

const factory = (inOptions?: Options) => {
  const { dest } = {
    ...defaults,
    ...inOptions,
  } as Required<Options>;

  console.log(`${LOG_PREFIX}:`, { dest });

  const plugin: Plugin = {
    name: PLUGIN_NAME,
    handleHotUpdate: async ({ file, server }) => {
      console.log('handleHotUpdate', file);
      if (file.endsWith('.json')) {
        server.ws.send({
          type: 'full-reload',
        });
      }
    },
  };

  return plugin;
};

export default factory;
