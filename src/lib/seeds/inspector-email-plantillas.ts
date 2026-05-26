/**
 * Seed canónico de PLANTILLAS DE EMAIL del pipeline de inspectores.
 *
 * Una plantilla por cada una de las 6 fases del pipeline (ver
 * `src/features/calidad/inspecciones/inspectores/data.ts`). El nombre del
 * evento coincide con el label de la fase para que coincida con la columna
 * del Kanban.
 *
 * Cualquier cambio aquí se propaga a TODAS las empresas existentes vía
 * `syncSeedsToAllEmpresas()` (modo aditivo: solo crea las fases que falten,
 * NO sobreescribe lo que el cliente haya personalizado) y se aplica a las
 * empresas nuevas vía `seedEmpresaDefaults()`.
 *
 * Placeholders disponibles en `asunto` y `cuerpo` (sustitución en envío):
 *   {{nombre}}            → inspector.nombre
 *   {{apellidos}}         → inspector.apellidos
 *   {{nombre_completo}}   → "nombre apellidos"
 *   {{empresa}}           → empresa.nombre
 *   {{ciudad}}            → inspector.ciudad
 *   {{telefono}}          → inspector.telefono
 *   {{email}}             → inspector.email
 *   {{enlace_bolsa}}      → URL pública de la bolsa de inspectores
 */

import type { InspectorFase } from "@/features/calidad/inspecciones/inspectores/types";

export interface InspectorEmailPlantillaSeed {
  fase: InspectorFase;
  /** Label de la fase (debe coincidir con FASES_INSPECTOR_CONFIG[fase].label) */
  nombre: string;
  asunto: string;
  cuerpo: string;
  activa: boolean;
}

export const INSPECTOR_EMAIL_PLANTILLAS_SEED: InspectorEmailPlantillaSeed[] = [
  // ───────────────────────────────────────────── 1. Nuevo (bolsa) ──
  {
    fase: "bolsa",
    nombre: "Nuevo",
    asunto: "Hemos recibido tu inscripción — {{empresa}}",
    cuerpo: `Hola {{nombre}},

Gracias por inscribirte en la bolsa de inspectores de {{empresa}}.

Hemos guardado tu candidatura correctamente. Nuestro equipo de Calidad la revisará en los próximos días y se pondrá en contacto contigo cuando surja una oportunidad de colaboración que encaje con tu perfil.

No tienes que hacer nada más por ahora.

Un saludo,
Equipo de Calidad de {{empresa}}`,
    activa: true,
  },

  // ─────────────────────────────────────── 2. Elegido (entrevista) ──
  {
    fase: "entrevista",
    nombre: "Elegido",
    asunto: "Queremos conocerte — {{empresa}}",
    cuerpo: `Hola {{nombre}},

¡Buenas noticias! Tu perfil nos ha encajado y queremos avanzar contigo en el proceso.

En breve te contactaremos en este mismo correo o en el teléfono {{telefono}} para coordinar una breve conversación y resolver cualquier duda que tengas sobre cómo funcionan nuestras inspecciones.

Si prefieres adelantarnos tu disponibilidad, responde a este email.

Un saludo,
Equipo de Calidad de {{empresa}}`,
    activa: true,
  },

  // ──────────────────────────────────────── 3. En proceso (prueba) ──
  {
    fase: "prueba",
    nombre: "En proceso",
    asunto: "Empezamos a trabajar juntos — {{empresa}}",
    cuerpo: `Hola {{nombre}},

¡Bienvenido/a! Pasas a la fase de colaboración con {{empresa}} y estás listo/a para realizar tus primeras inspecciones.

Te asignaremos visitas progresivamente y te enviaremos las instrucciones de cada inspección por este mismo canal. Recuerda que puedes consultar el enlace de la bolsa para repasar la información en cualquier momento:

{{enlace_bolsa}}

Gracias por sumarte. Cualquier duda, escríbenos.

Un saludo,
Equipo de Calidad de {{empresa}}`,
    activa: true,
  },

  // ───────────────────────────────────────── 4. Inspector (activo) ──
  {
    fase: "activo",
    nombre: "Inspector",
    asunto: "Eres parte del equipo de inspectores de {{empresa}}",
    cuerpo: `Hola {{nombre}},

Tras tus primeras colaboraciones, pasas a formar parte de nuestro equipo habitual de inspectores. Gracias por el trabajo realizado hasta ahora.

A partir de ahora recibirás asignaciones de forma regular según la disponibilidad que nos has indicado. Si en algún momento cambian tus datos de contacto o tu disponibilidad, responde a este email y lo actualizamos.

¡Bienvenido/a oficialmente al equipo!

Un saludo,
Equipo de Calidad de {{empresa}}`,
    activa: true,
  },

  // ──────────────────────────────────────── 5. Papelera (historico) ──
  {
    fase: "historico",
    nombre: "Papelera",
    asunto: "Sobre tu candidatura — {{empresa}}",
    cuerpo: `Hola {{nombre}},

Gracias por el interés que has mostrado en colaborar con {{empresa}} como inspector/a.

Tras revisar tu candidatura, en este momento no podemos seguir adelante con el proceso. Conservaremos tus datos para futuras oportunidades en las que tu perfil pueda encajar mejor.

Te deseamos lo mejor en tus próximos proyectos.

Un saludo,
Equipo de Calidad de {{empresa}}`,
    activa: false,
  },

  // ──────────────────────────────── 6. No se presenta (descartado) ──
  {
    fase: "descartado",
    nombre: "No se presenta",
    asunto: "Cerramos tu candidatura — {{empresa}}",
    cuerpo: `Hola {{nombre}},

Hemos intentado contactar contigo en varias ocasiones a través del teléfono {{telefono}} y este correo, sin éxito.

Por ese motivo, cerramos por el momento tu candidatura en la bolsa de inspectores de {{empresa}}. Si más adelante quieres retomar el proceso, puedes volver a inscribirte aquí:

{{enlace_bolsa}}

Un saludo,
Equipo de Calidad de {{empresa}}`,
    activa: false,
  },
];

/** Conjunto de fases válidas para validación rápida. */
export const INSPECTOR_EMAIL_PLANTILLA_FASES = new Set<InspectorFase>(
  INSPECTOR_EMAIL_PLANTILLAS_SEED.map((p) => p.fase),
);
