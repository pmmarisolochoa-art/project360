-- Bucket público para assets de marca de cliente (logos). Público en LECTURA
-- porque el logo se muestra en el header del cerebro y la tarjeta de Clientes
-- sin pasar por auth (ej. portal de cliente); escritura solo para usuarios
-- autenticados (equipo de la agencia).
insert into storage.buckets (id, name, public)
values ('client-assets', 'client-assets', true)
on conflict (id) do nothing;

create policy "client_assets_public_read"
on storage.objects for select
to public
using (bucket_id = 'client-assets');

create policy "client_assets_auth_write"
on storage.objects for insert
to authenticated
with check (bucket_id = 'client-assets');

create policy "client_assets_auth_update"
on storage.objects for update
to authenticated
using (bucket_id = 'client-assets');

create policy "client_assets_auth_delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'client-assets');
