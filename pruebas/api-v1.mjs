/**
 * Corredor de las pruebas de la API pública v1.
 *
 * Compila los endpoints reales con esbuild sustituyendo `@supabase/supabase-js`
 * por un doble de pruebas (`stub-supabase.mjs`), y luego los llama con objetos
 * `Request` de verdad. O sea: se ejercita el mismo código que va a producción,
 * sin tocar ninguna base de datos.
 *
 * EL DETALLE QUE COSTÓ UN RATO
 * El stub se marca como `external`. Si se empaqueta dentro de cada bundle,
 * esbuild le da a cada endpoint SU PROPIA copia del estado y las pruebas leen
 * un estado que nadie escribió — daban falsos negativos rarísimos.
 */

import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const aqui = dirname(fileURLToPath(import.meta.url));
const stub = join(aqui, 'stub-supabase.mjs');

await build({
  entryPoints: {
    tasks: join(aqui, '../api/v1/tasks/index.ts'),
    tarea: join(aqui, '../api/v1/tasks/[id]/index.ts'),
    estado: join(aqui, '../api/v1/tasks/[id]/status.ts'),
    meetings: join(aqui, '../api/v1/meetings/index.ts'),
  },
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  outdir: join(aqui, '.build'),
  logLevel: 'error',
  plugins: [
    {
      name: 'supabase-falso',
      setup(b) {
        b.onResolve({ filter: /^@supabase\/supabase-js$/ }, () => ({ path: stub, external: true }));
      },
    },
  ],
});

await import('./_casos.mjs');
