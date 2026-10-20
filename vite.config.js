import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [
      react(),
      {
        name: 'offline-assets-manifest',
        apply: 'build',
        generateBundle(_options, bundle) {
          const assets = Object.keys(bundle)
            .filter((fileName) => /\.(js|css|png|jpe?g|svg|webp|woff2?|ttf|otf)$/i.test(fileName))
            .map((fileName) => `/${fileName}`);
          this.emitFile({
            type: 'asset',
            fileName: 'offline-assets.json',
            source: JSON.stringify(assets),
          });
        },
      },
    ],
    server: {
      host: '0.0.0.0',
      allowedHosts: ['codespaces-react-rm12.onrender.com'],
      proxy: {
        '/api': {
          target: env.VITE_API_PROXY_TARGET || 'http://localhost:4000',
          changeOrigin: true,
          secure: true,
          headers: { origin: 'http://localhost:3000' },
        },
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      exclude: ['**/node_modules/**', '**/dist/**', 'backend/**'],
    },
  };
});
