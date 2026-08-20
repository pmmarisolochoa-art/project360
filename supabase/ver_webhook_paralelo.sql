-- Que nos ha mandado Paralelo. Solo lee.

-- 1. Resumen: cuantas llamadas y cuando.
select count(*) as llamadas,
       min(recibido_en) as primera,
       max(recibido_en) as ultima
from public.paralelo_webhook_log;

-- 2. Las 20 ultimas, con el cuerpo recortado para poder leerlas.
select recibido_en, bytes,
       left(coalesce(cuerpo_texto,''), 300) as inicio_del_cuerpo
from public.paralelo_webhook_log
order by recibido_en desc
limit 20;

-- 3. Que CLAVES trae el JSON. Esto es lo que de verdad hace falta para
--    escribir la integracion: saber su formato sin abrirlo a mano.
select clave, count(*) as veces
from public.paralelo_webhook_log, lateral jsonb_object_keys(cuerpo) as clave
where cuerpo is not null
group by clave
order by veces desc;

-- 4. Una llamada entera, la mas reciente, para verla completa.
select jsonb_pretty(cuerpo) as cuerpo_completo
from public.paralelo_webhook_log
where cuerpo is not null
order by recibido_en desc
limit 1;
