// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

// ARTIFACT=1 builds "file" routes (workflows/canvas.html) for static hosts
// that do not resolve directory indexes. See scripts/build-artifact.mjs.
const artifact = process.env.ARTIFACT === '1';

export default defineConfig({
  integrations: [react()],
  output: 'static',
  devToolbar: { enabled: false },
  server: { host: true, port: 4321 },
  // the artifact host reserves names starting with "_", so assets live in app/ there
  build: { format: artifact ? 'file' : 'directory', assets: artifact ? 'app' : '_astro' },
  vite: {
    ssr: { noExternal: ['boring-avatars'] },
  },
});
