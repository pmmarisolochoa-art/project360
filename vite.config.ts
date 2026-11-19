import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

// Color de fondo del tema oscuro (--bg-base en src/index.css), que es el tema
// por defecto. Se usa para la barra del sistema y la pantalla de arranque de la
// app instalada, así no hay un fogonazo blanco al abrirla.
const THEME_BG = '#0A0A0F';

export default defineConfig({
  plugins: [
    react(),
    // PWA: la app se puede instalar en el celular/escritorio. El service worker
    // se actualiza solo en cada deploy (autoUpdate), sin pedirle nada al usuario.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Project360',
        short_name: 'Project360',
        description: 'Sistema operativo de agencia: clientes, tareas, agenda, entregables y equipo.',
        lang: 'es',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: THEME_BG,
        theme_color: THEME_BG,
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // ClientBrainPage pesa ~1 MB; el límite por defecto (2 MB) basta, pero se
        // deja explícito para que un chunk grande no se quede fuera sin aviso.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        // Las funciones de Vercel (/api/*) NUNCA las responde el service worker
        // con el index.html de la SPA.
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Autenticación de Supabase: jamás se guarda en caché (tokens,
            // sesión, refresh). Va siempre directo a la red.
            urlPattern: ({ url }) => url.hostname.endsWith('.supabase.co') && url.pathname.startsWith('/auth/'),
            handler: 'NetworkOnly',
          },
          {
            // Datos de Supabase (REST/Storage, solo GET): primero la red; la
            // copia en caché solo se usa si no hay conexión. Escrituras
            // (POST/PATCH/DELETE) no pasan por aquí: workbox solo cachea GET.
            urlPattern: ({ url }) =>
              url.hostname.endsWith('.supabase.co') &&
              (url.pathname.startsWith('/rest/') || url.pathname.startsWith('/storage/')),
            handler: 'NetworkFirst',
            method: 'GET',
            options: {
              cacheName: 'supabase-data',
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [200] },
              plugins: [
                {
                  // PRIVACIDAD: la misma URL devuelve filas distintas según
                  // quién pregunta (RLS: privadas, asignaciones). Por eso la
                  // copia se guarda POR USUARIO: la llave de caché lleva el
                  // `sub` del token de Supabase. Así, aunque alguien entre con
                  // otra cuenta sin cerrar sesión, jamás recibe la copia de
                  // la cuenta anterior. Sin usuario identificable → no se
                  // guarda nada.
                  // OJO: workbox copia esta función tal cual dentro de sw.js,
                  // así que no puede usar nada de fuera de ella.
                  cacheKeyWillBeUsed: async ({ request }) => {
                    let uid = '';
                    try {
                      const auth = request.headers.get('Authorization') || '';
                      const payload = auth.replace(/^Bearer\s+/i, '').split('.')[1] || '';
                      const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
                      uid = JSON.parse(json).sub || '';
                    } catch {
                      uid = '';
                    }
                    const url = new URL(request.url);
                    url.searchParams.set('__p360_uid', uid || 'sin-usuario');
                    return url.href;
                  },
                  cacheWillUpdate: async ({ request, response }) => {
                    const auth = request.headers.get('Authorization') || '';
                    try {
                      const payload = auth.replace(/^Bearer\s+/i, '').split('.')[1] || '';
                      const sub = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))).sub;
                      return sub ? response : null;
                    } catch {
                      return null;
                    }
                  },
                },
              ],
            },
          },
          {
            urlPattern: ({ url }) =>
              url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: { port: 5173 },
  build: {
    rollupOptions: {
      output: {
        // Separa las dependencias que casi nunca cambian de nuestro código, que
        // cambia en cada deploy. Así un deploy nuevo no obliga a re-descargar
        // React ni Supabase: el navegador los reusa de caché.
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-charts': ['recharts'],
          'vendor-motion': ['framer-motion'],
        },
      },
    },
  },
});
