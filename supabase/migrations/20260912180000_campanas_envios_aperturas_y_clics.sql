-- Qué le pasó de verdad a cada correo de campaña.
--
-- Hasta ahora solo se sabía "salió" o "falló". La pantalla de campañas tenía
-- columnas de Abiertos y Tasa de apertura que marcaban 0 y 0% para siempre,
-- porque nada le contaba al software que un correo se hubiera abierto: eso lo
-- sabe Resend y no lo decía. Un 0% se lee como "nadie abre nuestros correos",
-- que es mentira y es peor que no tener el dato.
--
-- Lo rellena `/api/webhooks/resend`. Cuatro fechas, una por cosa que le puede
-- pasar a un correo. Fechas y no booleanos: saber CUÁNDO se abrió permite mirar
-- a qué hora se leen los correos —y por tanto a qué hora conviene enviarlos—,
-- que un sí/no no permite.
--
-- Idempotente.

alter table public.campanas_envios
  add column if not exists entregado_en timestamptz,
  add column if not exists clic_en      timestamptz,
  add column if not exists rebotado_en  timestamptz,
  add column if not exists queja_en     timestamptz;

comment on column public.campanas_envios.entregado_en is
  'Cuando el servidor del destinatario lo acepto. Distinto de enviado_en: entre los dos hay rebotes.';
comment on column public.campanas_envios.abierto_en is
  'Primera apertura. No se sobreescribe: interesa la primera vez que lo leyo.';
comment on column public.campanas_envios.clic_en is
  'Primer clic en un enlace del correo. Es la senal de intencion mas fuerte que da un correo.';
comment on column public.campanas_envios.rebotado_en is
  'Rebote duro: esa direccion no existe o no acepta correo.';
comment on column public.campanas_envios.queja_en is
  'Lo marco como spam. Vigilar: arrastra la reputacion del dominio y acaba tirando las confirmaciones de reserva.';

-- El proveedor nos da su identificador y por ahi se localiza cada envío al
-- llegar el aviso. Sin índice, cada aviso recorría la tabla entera.
create index if not exists campanas_envios_proveedor_idx
  on public.campanas_envios(proveedor_id) where proveedor_id is not null;

------------------------------------------------------------------
-- La vista de estadísticas, con lo que ahora sí se puede medir.
------------------------------------------------------------------
--
-- El orden de las columnas que ya existían NO se toca: `create or replace view`
-- solo admite añadir al final, y reordenarlas obligaría a tirar la vista con
-- todo lo que cuelgue de ella.
create or replace view public.v_campanas_atribucion as
  select c.id as campana_id,
         c.empresa_id,
         c.nombre,
         c.canal,
         c.estado,
         c.ultima_ejecucion,
         rl.palabra_clave as origen,
         -- Salió por la puerta.
         (select count(*) from public.campanas_envios e
           where e.campana_id = c.id and e.estado = any (array['enviado','abierto']))::integer as enviados,
         -- Lo abrió.
         (select count(*) from public.campanas_envios e
           where e.campana_id = c.id and (e.abierto_en is not null or e.estado = 'abierto'))::integer as abiertos,
         -- Y lo único que de verdad cuenta: mesas y comensales que trajo.
         (select count(*) from public.reservas r
           where r.campana_id = c.id)::integer as reservas_generadas,
         c.palabra,
         (select coalesce(sum(r.personas), 0) from public.reservas r
           where r.campana_id = c.id)::integer as personas_generadas,
         -- ── Lo nuevo, al final ──
         -- El servidor del destinatario lo aceptó.
         (select count(*) from public.campanas_envios e
           where e.campana_id = c.id and e.entregado_en is not null)::integer as entregados,
         -- Pulsó un enlace: la señal de intención más fuerte que da un correo.
         (select count(*) from public.campanas_envios e
           where e.campana_id = c.id and e.clic_en is not null)::integer as clics,
         -- No llegó: esa dirección ya no sirve.
         (select count(*) from public.campanas_envios e
           where e.campana_id = c.id and e.rebotado_en is not null)::integer as rebotados,
         -- Lo marcó como spam. Vigilar de cerca.
         (select count(*) from public.campanas_envios e
           where e.campana_id = c.id and e.queja_en is not null)::integer as quejas
    from public.campanas_marketing c
    left join public.reserva_links rl on rl.id = c.reserva_link_id;
