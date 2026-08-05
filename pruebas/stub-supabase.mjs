/** Supabase falso: registra lo que se le pide y devuelve lo que le digamos. */
export const estado = {
  keys: [],            // filas de api_keys
  rpcResp: {},         // nombre -> {data,error}
  llamadasRpc: [],     // qué funciones se llamaron y con qué argumentos
  requests: [],        // inserts al audit log
  conteo: 0,           // lo que devuelve el conteo del rate limit
};
export function reset(over = {}) {
  estado.keys = []; estado.rpcResp = {}; estado.llamadasRpc = [];
  estado.requests = []; estado.conteo = 0;
  Object.assign(estado, over);
}
const thenable = (valor) => {
  const b = {
    select: () => b, eq: (col, val) => { b._f = { ...(b._f||{}), [col]: val }; return b; },
    gte: () => b, order: () => b, limit: () => b,
    maybeSingle: async () => valor(b._f),
    single: async () => valor(b._f),
    then: (res) => Promise.resolve(valor(b._f)).then(res),
  };
  return b;
};
export function createClient() {
  return {
    from(tabla) {
      if (tabla === 'api_keys') return {
        select: () => thenable((f) => {
          const fila = estado.keys.find((k) => k.key_hash === f?.key_hash);
          return { data: fila ?? null, error: null };
        }),
        update: () => thenable(() => ({ data: null, error: null })),
      };
      if (tabla === 'api_requests') return {
        select: (_c, opts) => opts?.head ? thenable(() => ({ count: estado.conteo, error: null })) : thenable(() => ({ data: [], error: null })),
        insert: (fila) => { estado.requests.push(fila); return thenable(() => ({ error: null })); },
      };
      throw new Error('tabla inesperada: ' + tabla);
    },
    async rpc(nombre, args) {
      estado.llamadasRpc.push({ nombre, args });
      return estado.rpcResp[nombre] ?? { data: [], error: null };
    },
  };
}
