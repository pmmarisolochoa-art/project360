import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

/**
 * Red de seguridad de Project360 / Ikigai Agencia.
 *
 * Criterio: bloquear SOLO lo que es un bug real. El resto entra como aviso
 * para que se pueda ir limpiando sin frenar el MVP — un linter que grita por
 * todo se termina ignorando, y entonces no sirve para nada.
 *
 * A medida que se limpie una categoría, se sube de 'warn' a 'error' para que
 * no vuelva a colarse.
 */
export default tseslint.config(
  // `api/` y `supabase/` corren en Node/Postgres, no en el navegador.
  { ignores: ['dist', 'node_modules', 'api', 'supabase'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      // ── ERROR: bugs de verdad ─────────────────────────────────────────────
      // Un hook dentro de un if rompe React de forma impredecible.
      'react-hooks/rules-of-hooks': 'error',

      // ── AVISO: deuda a limpiar, no bloquea ────────────────────────────────
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Reglas del react-compiler: útiles pero muy ruidosas en código que
      // nunca se lint-eó. Aviso hasta hacer una pasada dedicada.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/purity': 'warn',
      // Patrones intencionales del código (feature-flags `{false && …}`).
      'no-constant-binary-expression': 'warn',
      '@typescript-eslint/no-unused-expressions': 'warn',
      'no-irregular-whitespace': 'warn',
      'prefer-const': 'warn',
    },
  },
)
