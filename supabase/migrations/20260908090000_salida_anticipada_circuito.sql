-- Circuito de SALIDA ANTICIPADA: quien cierra su jornada antes de la hora del
-- turno explica por qué, y eso genera una solicitud que alguien aprueba o
-- rechaza. Aprobar = las horas cuentan. Rechazar = ese día se queda a 0:00 h.
--
-- Hasta ahora la "paralización" con motivo existía, pero era un camino opcional
-- y escondido (la píldora verde del móvil): el botón normal de salir cerraba la
-- jornada sin preguntar nada, el motivo que se escribía no se mostraba en
-- ninguna pantalla y nadie tenía que aprobar nada.

-- ─── 1. Columnas que están en producción pero no estaban versionadas ────────
-- `requiere_revision` y `revision_motivo` se escriben desde el código desde
-- hace meses (cierres huérfanos, deriva de reloj offline, cierre masivo) pero
-- ninguna migración las creaba: un entorno nuevo arrancaba sin ellas y esos
-- cierres petaban. Se declaran aquí, idempotentes, sin tocar los datos.
alter table public.fichajes add column if not exists requiere_revision boolean not null default false;
alter table public.fichajes add column if not exists revision_motivo text;

-- ─── 2. La salida nunca puede ser anterior a la entrada ─────────────────────
-- El código ya lo impide en las cinco vías de cierre, pero la tabla lo aceptaba
-- igual: una importación o un arreglo a mano podía volver a colar horas
-- negativas. Aquí se cierra de verdad.
update public.fichajes
   set hora_salida = hora_entrada
 where hora_salida is not null
   and hora_entrada is not null
   and hora_salida < hora_entrada;

update public.fichajes set horas_totales = 0 where horas_totales < 0;

alter table public.fichajes drop constraint if exists fichajes_salida_no_antes_chk;
alter table public.fichajes add constraint fichajes_salida_no_antes_chk
  check (hora_salida is null or hora_entrada is null or hora_salida >= hora_entrada);

alter table public.fichajes drop constraint if exists fichajes_horas_no_negativas_chk;
alter table public.fichajes add constraint fichajes_horas_no_negativas_chk
  check (horas_totales is null or horas_totales >= 0);

-- ─── 3. Mínimo para poder cerrar un fichaje ─────────────────────────────────
-- Nadie cierra su jornada en los primeros N minutos: un toque sin querer no
-- puede costar el turno entero. Mínimo 30, que es lo pactado, y por eso la
-- cortesía (que redondea a la hora del turno) está topada en 15: así las dos
-- ventanas nunca se pisan.
alter table public.empresa_fichajes_config
  add column if not exists min_minutos_para_cerrar integer not null default 30;

update public.empresa_fichajes_config
   set min_minutos_para_cerrar = 30
 where min_minutos_para_cerrar is null or min_minutos_para_cerrar < 30;

alter table public.empresa_fichajes_config
  drop constraint if exists empresa_fichajes_config_min_cierre_chk;
alter table public.empresa_fichajes_config
  add constraint empresa_fichajes_config_min_cierre_chk
  check (min_minutos_para_cerrar >= 30 and min_minutos_para_cerrar <= 240);

-- ─── 4. La solicitud de salida anticipada ───────────────────────────────────
-- Cuarto tipo, junto a ausencia / trabajo / entrega.
alter table public.solicitudes_personal drop constraint if exists solicitudes_personal_tipo_check;
alter table public.solicitudes_personal add constraint solicitudes_personal_tipo_check
  check (tipo in ('ausencia', 'trabajo', 'entrega', 'salida_anticipada'));

alter table public.solicitudes_personal drop constraint if exists solicitudes_personal_subtipo_check;
alter table public.solicitudes_personal add constraint solicitudes_personal_subtipo_check
  check (subtipo in (
    'baja_medica', 'vacaciones', 'permiso', 'baja_contrato',
    'horas_extras', 'dia_trabajado', 'entrega_material', 'salida_anticipada'
  ));

-- Qué fichaje cerró antes de tiempo, y a qué hora debía haber terminado.
-- `fichajes.solicitud_id` ya existe y ata el fichaje a su solicitud; esto es el
-- lado contrario, para que la solicitud sepa a qué día se refiere sin rehacer
-- el cálculo del horario cada vez que se pinta la lista.
alter table public.solicitudes_personal
  add column if not exists fichaje_id uuid references public.fichajes(id) on delete set null;
alter table public.solicitudes_personal
  add column if not exists salida_prevista timestamptz;

create index if not exists solicitudes_personal_fichaje_idx
  on public.solicitudes_personal (fichaje_id)
  where fichaje_id is not null;

-- Una salida anticipada siempre dice de qué fichaje viene y por qué.
alter table public.solicitudes_personal
  drop constraint if exists solicitudes_personal_salida_anticipada_chk;
alter table public.solicitudes_personal
  add constraint solicitudes_personal_salida_anticipada_chk
  check (
    tipo <> 'salida_anticipada'
    or (fichaje_id is not null and motivo is not null and length(btrim(motivo)) >= 15)
  );

-- ─── 5. Rechazar una salida anticipada exige explicarse ─────────────────────
-- El trabajador está obligado a escribir su motivo; quien rechaza, también: es
-- el texto que le llega y donde se le dice qué hacer para arreglarlo.
--
-- La regla se ata SOLO a las salidas anticipadas. En el histórico hay dos
-- solicitudes de otros tipos rechazadas sin motivo escrito, y no se reescribe
-- historial para que entre una regla nueva. Para los demás tipos, la obligación
-- vive en el código, de aquí en adelante.
alter table public.solicitudes_personal
  drop constraint if exists solicitudes_personal_rechazo_motivado_chk;
alter table public.solicitudes_personal
  add constraint solicitudes_personal_rechazo_motivado_chk
  check (
    tipo <> 'salida_anticipada'
    or estado <> 'rechazada'
    or (notas_revision is not null and length(btrim(notas_revision)) >= 15)
  );
