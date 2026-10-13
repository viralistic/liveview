// Local-only dev config with a private Vite cache (several dev servers share node_modules).
import base from './astro.config.mjs';
export default { ...base, vite: { ...(base.vite ?? {}), cacheDir: '/tmp/claude-0/-home-user-liveview/237894a5-eda7-5a8e-807c-3f852420ace3/scratchpad/vite-cache-products' } };
