import { fileURLToPath, URL } from 'node:url'
import { readFileSync } from 'node:fs'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
      // Ambiente de deploy (o Vercel injeta estas no build):
      //   VERCEL_ENV = production | preview | development
      //   VERCEL_GIT_COMMIT_REF = nome do branch
      __APP_ENV__: JSON.stringify(process.env.VERCEL_ENV || 'local'),
      __GIT_BRANCH__: JSON.stringify(process.env.VERCEL_GIT_COMMIT_REF || ''),
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/test/setup.js',
      css: true,
      // Apenas os testes do frontend. O backend tem o seu próprio runner.
      include: ['src/**/*.{test,spec}.{js,jsx}'],
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom'],
            'data-vendor': ['@tanstack/react-query', 'zod'],
            'ui-vendor': ['framer-motion', 'sonner'],
            'search-vendor': ['fuse.js', 'date-fns'],
          },
        },
      },
    },
    server: {
      proxy: {
        // Backend próprio (System of Record): auth, papéis e gestão das escalas.
        '/auth': {
          target: env.BACKEND_URL || 'http://localhost:4000',
          changeOrigin: true,
        },
        '/data': {
          target: env.BACKEND_URL || 'http://localhost:4000',
          changeOrigin: true,
        },
        // Estado dos serviços (health check).
        '/health': {
          target: env.BACKEND_URL || 'http://localhost:4000',
          changeOrigin: true,
        },
      },
    },
  }
})
