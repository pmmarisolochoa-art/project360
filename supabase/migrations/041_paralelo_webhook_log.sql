-- 041 - Bitacora del webhook de Paralelo
--
-- Paralelo confirmo (19-ago) que su plataforma manda webhooks, y pidio una URL
-- vacia que solo registre lo que llega: con ese registro sabremos que nos
-- mandan y como es, y a partir de ahi se escribe la integracion de verdad.
--
-- Esta tabla ES ese registro. Guarda la llamada CRUDA, sin interpretarla: si la
-- interpretaramos ya estariamos adivinando el formato, que es justo lo que se
-- quiere evitar. Primero se mira lo que llega; despues se decide que hacer.
--
-- Nada de esto toca tareas ni reuniones todavia. Es solo una bitacora.
--
-- Idempotente.

create table if not exists public.paralelo_webhook_log (
  id           uuid primary key default gen_random_uuid(),
  recibido_en  timestamptz not null default now(),
  metodo       text,
  ruta         text,
  cabeceras    jsonb,
  cuerpo       jsonb,
  cuerpo_texto text,
  bytes        integer,
  ip           text
);

create index if not exists paralelo_webhook_log_fecha_idx
  on public.paralelo_webhook_log (recibido_en desc);

comment on table public.paralelo_webhook_log is
  'Llamadas crudas del webhook de Paralelo. Bitacora para descubrir su formato; no alimenta nada todavia.';

comment on column public.paralelo_webhook_log.cuerpo is
  'El JSON tal cual llego. Nulo si no era JSON valido: en ese caso mirar cuerpo_texto.';

comment on column public.paralelo_webhook_log.cuerpo_texto is
  'El cuerpo en texto plano, siempre. Sirve cuando no es JSON o llega mal formado.';

-- RLS encendido y SIN policies a proposito: nadie lo lee con su sesion.
-- Se consulta desde el editor SQL de Supabase, que usa la llave de servicio.
-- Una bitacora de integracion puede traer datos de reuniones de clientes; no
-- hay razon para que sea legible desde la app.
alter table public.paralelo_webhook_log enable row level security;
