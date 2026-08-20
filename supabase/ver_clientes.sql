-- Nombres exactos de los clientes. Solo lee.
select name, is_agency, status, created_at::date
from public.clients
order by is_agency desc, name;
