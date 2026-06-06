-- PRP-054 · Fase 2 — Realtime Authorization para canales privados de llamadas internas.
--
-- Topics:
--   'llamadas:empresa:<empresa_uuid>'   → señalización WebRTC (broadcast efímero)
--   'llamadas:presencia:<empresa_uuid>' → presencia (quién está conectado)
--
-- La señalización SDP/ICE NO pasa por RLS de tabla (es Broadcast), así que el
-- aislamiento multi-tenant se garantiza con RLS sobre realtime.messages: solo
-- usuarios autenticados con acceso a esa empresa (empresas_del_usuario()) pueden
-- recibir (SELECT) o enviar (INSERT) en esos topics. Los canales privados ya
-- estaban denegados (RLS activa, 0 políticas); estas políticas son aditivas y no
-- afectan a los canales públicos existentes (postgres_changes).

-- Extrae el UUID de empresa del topic de forma segura (NULL si no aplica / inválido).
create or replace function public.llamadas_topic_empresa_id(p_topic text)
returns uuid
language plpgsql
immutable
as $$
declare
  v uuid;
begin
  if p_topic !~ '^llamadas:(empresa|presencia):' then
    return null;
  end if;
  begin
    v := split_part(p_topic, ':', 3)::uuid;
  exception when others then
    return null;
  end;
  return v;
end;
$$;

grant execute on function public.llamadas_topic_empresa_id(text) to authenticated;

-- Recibir mensajes (broadcast + presence) del topic: solo si la empresa del topic
-- está entre las empresas del usuario.
drop policy if exists llamadas_realtime_select on realtime.messages;
create policy llamadas_realtime_select on realtime.messages
  for select to authenticated
  using (
    public.llamadas_topic_empresa_id(realtime.topic()) in (select empresas_del_usuario())
  );

-- Enviar mensajes (broadcast + presence) al topic: misma condición.
drop policy if exists llamadas_realtime_insert on realtime.messages;
create policy llamadas_realtime_insert on realtime.messages
  for insert to authenticated
  with check (
    public.llamadas_topic_empresa_id(realtime.topic()) in (select empresas_del_usuario())
  );
