// Datos semilla del Portal de Formación (estilo classroom).
// Cada empresa tiene cursos. Cada curso tiene secciones. Cada sección tiene lecciones.
// La persistencia real vive en localStorage; esto es sólo el contenido inicial.

import type {
  Curso,
  Leccion,
  NovedadFormacion,
  Seccion,
} from "../types";

const SAMPLE_MP4 =
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";

const HOY = "2026-05-01";

// Helper para generar lecciones más limpias.
let _idSeq = 0;
function genId(prefix: string): string {
  _idSeq += 1;
  return `${prefix}-${_idSeq.toString(36)}`;
}

interface DraftLeccion {
  titulo: string;
  descripcion: string;
  duracionMin: number;
  fechaSubida: string;
  recursos?: { titulo: string; url: string; tipo: string }[];
}
interface DraftSeccion {
  titulo: string;
  lecciones: DraftLeccion[];
}
interface DraftCurso {
  titulo: string;
  descripcion: string;
  cover: string;
  categoria: Curso["categoria"];
  ambito: Curso["ambito"];
  puesto?: Curso["puesto"];
  empresaId: string;
  fechaPublicacion: string;
  autor: string;
  secciones: DraftSeccion[];
}

function expandirCursos(drafts: DraftCurso[]): {
  cursos: Curso[];
  secciones: Seccion[];
  lecciones: Leccion[];
} {
  const cursos: Curso[] = [];
  const secciones: Seccion[] = [];
  const lecciones: Leccion[] = [];

  drafts.forEach((d, idx) => {
    const cursoId = genId("c");
    cursos.push({
      id: cursoId,
      titulo: d.titulo,
      descripcion: d.descripcion,
      cover: d.cover,
      categoria: d.categoria,
      ambito: d.ambito,
      puesto: d.puesto,
      empresaId: d.empresaId,
      orden: idx + 1,
      fechaPublicacion: d.fechaPublicacion,
      autor: d.autor,
      publicado: true,
    });

    d.secciones.forEach((s, sIdx) => {
      const seccionId = genId("s");
      secciones.push({
        id: seccionId,
        cursoId,
        titulo: s.titulo,
        orden: sIdx + 1,
      });
      s.lecciones.forEach((l, lIdx) => {
        const leccionId = genId("l");
        lecciones.push({
          id: leccionId,
          seccionId,
          cursoId,
          titulo: l.titulo,
          descripcion: l.descripcion,
          url: SAMPLE_MP4,
          duracionMin: l.duracionMin,
          orden: lIdx + 1,
          fechaSubida: l.fechaSubida,
          recursos: (l.recursos ?? []).map((r) => ({
            id: genId("r"),
            ...r,
          })),
        });
      });
    });
  });

  return { cursos, secciones, lecciones };
}

// ─── Catálogo HABANA ────────────────────────────────────────────

const HABANA_DRAFTS: DraftCurso[] = [
  {
    titulo: "Bienvenida a Balles Hosteleros",
    descripcion:
      "Tu primer curso al entrar. Quiénes somos, cómo funcionamos y qué esperamos de ti.",
    cover:
      "linear-gradient(135deg, #1e3a8a 0%, #2563eb 50%, #38bdf8 100%)",
    categoria: "bienvenida",
    ambito: "general",
    empresaId: "habana",
    fechaPublicacion: "2026-04-20",
    autor: "Dirección",
    secciones: [
      {
        titulo: "Empieza por aquí",
        lecciones: [
          {
            titulo: "Bienvenido al equipo",
            descripcion:
              "Quiénes somos y por qué hacemos lo que hacemos. 6 minutos.",
            duracionMin: 6,
            fechaSubida: "2026-04-20",
            recursos: [
              {
                titulo: "Manual del empleado (PDF)",
                url: "#",
                tipo: "pdf",
              },
            ],
          },
          {
            titulo: "Nuestros valores e Ikigai",
            descripcion:
              "Cómo aplicamos la filosofía Ikigai al servicio diario.",
            duracionMin: 8,
            fechaSubida: "2026-04-20",
          },
        ],
      },
      {
        titulo: "Funcionamiento interno",
        lecciones: [
          {
            titulo: "Fichajes, horarios y ausencias",
            descripcion:
              "Cómo fichas, cómo solicitas un cambio y a quién avisas si no puedes venir.",
            duracionMin: 5,
            fechaSubida: "2026-04-21",
          },
          {
            titulo: "Uniforme y aspecto personal",
            descripcion:
              "Qué ponerte cada turno. Higiene, joyas y olor neutro.",
            duracionMin: 4,
            fechaSubida: "2026-04-21",
          },
          {
            titulo: "Comunicación con tu responsable",
            descripcion:
              "Canales oficiales, escalado y reglas básicas de WhatsApp.",
            duracionMin: 5,
            fechaSubida: "2026-04-22",
          },
        ],
      },
    ],
  },
  {
    titulo: "Seguridad e higiene en hostelería",
    descripcion:
      "APPCC, alérgenos, EPI, evacuación y primeros auxilios. Obligatorio para todos.",
    cover:
      "linear-gradient(135deg, #065f46 0%, #10b981 50%, #6ee7b7 100%)",
    categoria: "seguridad",
    ambito: "general",
    empresaId: "habana",
    fechaPublicacion: "2026-02-10",
    autor: "Calidad",
    secciones: [
      {
        titulo: "APPCC y alérgenos",
        lecciones: [
          {
            titulo: "Qué es APPCC y por qué lo aplicamos",
            descripcion:
              "Sistema de control crítico explicado en 7 minutos.",
            duracionMin: 7,
            fechaSubida: "2026-02-10",
          },
          {
            titulo: "Tabla de alérgenos del local",
            descripcion: "Los 14 alérgenos y cómo informarlos al cliente.",
            duracionMin: 6,
            fechaSubida: "2026-02-10",
          },
        ],
      },
      {
        titulo: "Seguridad y emergencias",
        lecciones: [
          {
            titulo: "EPI y manipulación segura",
            descripcion: "Equipos de protección que tienes que usar.",
            duracionMin: 4,
            fechaSubida: "2026-02-12",
          },
          {
            titulo: "Plan de evacuación y primeros auxilios",
            descripcion: "Salidas, extintores y RCP básico.",
            duracionMin: 9,
            fechaSubida: "2026-02-12",
          },
        ],
      },
    ],
  },
  {
    titulo: "Camarero — protocolo de sala",
    descripcion:
      "Todo lo que un camarero de Habana necesita el primer mes en su puesto.",
    cover:
      "linear-gradient(135deg, #7c2d12 0%, #ea580c 50%, #fdba74 100%)",
    categoria: "protocolo",
    ambito: "puesto",
    puesto: "CAMARERO",
    empresaId: "habana",
    fechaPublicacion: "2026-04-25",
    autor: "Jefe de Sala",
    secciones: [
      {
        titulo: "Apertura del servicio",
        lecciones: [
          {
            titulo: "Montaje de mesas y mise en place",
            descripcion: "Mantelería, cubertería y bandeja de servicio.",
            duracionMin: 7,
            fechaSubida: "2026-04-25",
          },
          {
            titulo: "Lectura de reservas y briefing",
            descripcion: "Cómo prepararte antes de abrir puertas.",
            duracionMin: 5,
            fechaSubida: "2026-04-25",
          },
        ],
      },
      {
        titulo: "Servicio en mesa",
        lecciones: [
          {
            titulo: "Cómo tomar comanda en TPV",
            descripcion: "Mesas, modificadores, alérgenos y envío a cocina.",
            duracionMin: 6,
            fechaSubida: "2026-04-25",
          },
          {
            titulo: "Recomendar carta y bebidas",
            descripcion: "Frases tipo y up-selling sin parecer agresivo.",
            duracionMin: 6,
            fechaSubida: "2026-04-26",
          },
          {
            titulo: "Atención al cliente VIP",
            descripcion: "Trato preferente, orden de servicio y quejas.",
            duracionMin: 8,
            fechaSubida: "2026-04-26",
          },
        ],
      },
      {
        titulo: "Cierre",
        lecciones: [
          {
            titulo: "Cobro, propinas y arqueo",
            descripcion: "Tickets, formas de pago y cuadre del turno.",
            duracionMin: 5,
            fechaSubida: "2026-03-30",
          },
          {
            titulo: "Cierre de sala y entrega de turno",
            descripcion: "Limpieza, traspaso y reporte al responsable.",
            duracionMin: 4,
            fechaSubida: "2026-03-30",
          },
        ],
      },
    ],
  },
  {
    titulo: "Jefe de Sala — liderazgo y operativa",
    descripcion:
      "Cómo llevar el equipo, gestionar quejas y cerrar el turno con todo cuadrado.",
    cover:
      "linear-gradient(135deg, #581c87 0%, #9333ea 50%, #d8b4fe 100%)",
    categoria: "operativa",
    ambito: "puesto",
    puesto: "JEFE DE SALA",
    empresaId: "habana",
    fechaPublicacion: "2026-04-12",
    autor: "Gerencia",
    secciones: [
      {
        titulo: "Equipo",
        lecciones: [
          {
            titulo: "Asignar turnos y briefing diario",
            descripcion: "Plantilla, repartos y minutos previos al servicio.",
            duracionMin: 9,
            fechaSubida: "2026-04-12",
          },
          {
            titulo: "Feedback al equipo",
            descripcion: "Cómo dar feedback en caliente sin desmotivar.",
            duracionMin: 6,
            fechaSubida: "2026-04-12",
          },
        ],
      },
      {
        titulo: "Cliente",
        lecciones: [
          {
            titulo: "Resolución de conflictos",
            descripcion: "Marco de actuación, frases tipo y escalado.",
            duracionMin: 7,
            fechaSubida: "2026-03-05",
          },
        ],
      },
    ],
  },
  {
    titulo: "Cocinero — partidas y fichas técnicas",
    descripcion:
      "Cómo trabajar tu partida en Habana y mantener la consistencia de la carta.",
    cover:
      "linear-gradient(135deg, #92400e 0%, #f59e0b 50%, #fde68a 100%)",
    categoria: "operativa",
    ambito: "puesto",
    puesto: "COCINERO",
    empresaId: "habana",
    fechaPublicacion: "2026-04-18",
    autor: "Jefe de Cocina",
    secciones: [
      {
        titulo: "Antes del servicio",
        lecciones: [
          {
            titulo: "Mise en place de tu partida",
            descripcion: "Organización del puesto antes del servicio.",
            duracionMin: 6,
            fechaSubida: "2026-04-18",
          },
        ],
      },
      {
        titulo: "Durante el servicio",
        lecciones: [
          {
            titulo: "Fichas técnicas y emplatado",
            descripcion: "Seguir la ficha y mantener consistencia.",
            duracionMin: 8,
            fechaSubida: "2026-04-18",
          },
          {
            titulo: "Comunicación con sala",
            descripcion: "Cómo se piden las cosas y se confirman.",
            duracionMin: 4,
            fechaSubida: "2026-04-18",
          },
        ],
      },
    ],
  },
  {
    titulo: "Cachimbero — preparación y normativa",
    descripcion:
      "Preparar cachimbas como manda Habana y respetar la normativa.",
    cover:
      "linear-gradient(135deg, #831843 0%, #db2777 50%, #fbcfe8 100%)",
    categoria: "operativa",
    ambito: "puesto",
    puesto: "CACHIMBERO",
    empresaId: "habana",
    fechaPublicacion: "2026-04-15",
    autor: "Jefe de Sala",
    secciones: [
      {
        titulo: "Preparación",
        lecciones: [
          {
            titulo: "Carbón, melaza y sellado",
            descripcion: "Preparar la cachimba paso a paso.",
            duracionMin: 10,
            fechaSubida: "2026-04-15",
          },
          {
            titulo: "Mantenimiento durante el servicio",
            descripcion: "Cuándo cambiar el carbón y cómo recuperar tiro.",
            duracionMin: 5,
            fechaSubida: "2026-04-15",
          },
        ],
      },
      {
        titulo: "Normativa",
        lecciones: [
          {
            titulo: "Edad mínima del cliente y ventilación",
            descripcion: "Lo que la ley exige y lo que pedimos en sala.",
            duracionMin: 5,
            fechaSubida: "2026-04-15",
          },
        ],
      },
    ],
  },
  {
    titulo: "Artista / DJ — operativa de cabina",
    descripcion: "Equipos de sonido, conexión y protocolo de escenario.",
    cover:
      "linear-gradient(135deg, #312e81 0%, #6366f1 50%, #c7d2fe 100%)",
    categoria: "operativa",
    ambito: "puesto",
    puesto: "ARTISTA",
    empresaId: "habana",
    fechaPublicacion: "2026-03-25",
    autor: "Dirección",
    secciones: [
      {
        titulo: "Antes del show",
        lecciones: [
          {
            titulo: "Conexión de mesa y prueba",
            descripcion: "Cómo dejar todo listo antes de abrir.",
            duracionMin: 7,
            fechaSubida: "2026-03-25",
          },
        ],
      },
    ],
  },
];

// ─── Catálogo BACANAL ──────────────────────────────────────────

const BACANAL_DRAFTS: DraftCurso[] = [
  {
    titulo: "Bienvenida a Bacanal",
    descripcion: "Concepto del local, marca y tono de servicio.",
    cover:
      "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #38bdf8 100%)",
    categoria: "bienvenida",
    ambito: "general",
    empresaId: "bacanal",
    fechaPublicacion: "2026-04-10",
    autor: "Dirección",
    secciones: [
      {
        titulo: "Cultura Bacanal",
        lecciones: [
          {
            titulo: "Quiénes somos y a quién servimos",
            descripcion: "Marca, cliente objetivo y tono.",
            duracionMin: 5,
            fechaSubida: "2026-04-10",
          },
          {
            titulo: "Política de calidad y reclamaciones",
            descripcion: "Cómo se gestiona una queja en Bacanal.",
            duracionMin: 7,
            fechaSubida: "2026-03-20",
          },
        ],
      },
    ],
  },
  {
    titulo: "Camarero VIP — Bacanal",
    descripcion: "Mesas reservadas, botellas y atención preferente.",
    cover:
      "linear-gradient(135deg, #422006 0%, #ca8a04 50%, #fde68a 100%)",
    categoria: "protocolo",
    ambito: "puesto",
    puesto: "CAMARERO",
    empresaId: "bacanal",
    fechaPublicacion: "2026-04-08",
    autor: "Jefe de Sala",
    secciones: [
      {
        titulo: "VIP",
        lecciones: [
          {
            titulo: "Protocolo de mesa reservada",
            descripcion: "Llegada, presentación y orden de servicio.",
            duracionMin: 9,
            fechaSubida: "2026-04-08",
          },
          {
            titulo: "Servicio de botella",
            descripcion: "Cómo se presenta, sirve y repone una botella.",
            duracionMin: 6,
            fechaSubida: "2026-04-08",
          },
        ],
      },
    ],
  },
  {
    titulo: "Gerente — cuadro de mando",
    descripcion: "Lectura diaria de KPIs y reporte a dirección.",
    cover:
      "linear-gradient(135deg, #1f2937 0%, #4f46e5 50%, #93c5fd 100%)",
    categoria: "operativa",
    ambito: "puesto",
    puesto: "GERENTE",
    empresaId: "bacanal",
    fechaPublicacion: "2026-04-01",
    autor: "Dirección",
    secciones: [
      {
        titulo: "Datos diarios",
        lecciones: [
          {
            titulo: "KPIs del local",
            descripcion: "Qué mirar y cuándo levantar la mano.",
            duracionMin: 8,
            fechaSubida: "2026-04-01",
          },
        ],
      },
    ],
  },
  {
    titulo: "Contable — cierres del mes",
    descripcion: "Conciliación de caja, facturas y exportación a gestoría.",
    cover:
      "linear-gradient(135deg, #064e3b 0%, #0d9488 50%, #99f6e4 100%)",
    categoria: "operativa",
    ambito: "puesto",
    puesto: "CONTABLE",
    empresaId: "bacanal",
    fechaPublicacion: "2026-03-12",
    autor: "Contabilidad",
    secciones: [
      {
        titulo: "Cierre mensual",
        lecciones: [
          {
            titulo: "Conciliación de caja",
            descripcion: "Paso a paso para cerrar caja del mes.",
            duracionMin: 11,
            fechaSubida: "2026-03-12",
          },
          {
            titulo: "Exportar a gestoría",
            descripcion: "Formato, ruta y revisión cruzada.",
            duracionMin: 5,
            fechaSubida: "2026-03-12",
          },
        ],
      },
    ],
  },
];

const habana = expandirCursos(HABANA_DRAFTS);
const bacanal = expandirCursos(BACANAL_DRAFTS);

// Construimos novedades referenciando lecciones que sí existen en el seed.
function findLeccion(
  empresaId: string,
  cursoTitulo: string,
  leccionTitulo: string,
): { cursoId: string; leccionId: string } | null {
  const seed = empresaId === "habana" ? habana : bacanal;
  const curso = seed.cursos.find((c) => c.titulo === cursoTitulo);
  if (!curso) return null;
  const leccion = seed.lecciones.find(
    (l) => l.cursoId === curso.id && l.titulo === leccionTitulo,
  );
  if (!leccion) return null;
  return { cursoId: curso.id, leccionId: leccion.id };
}

const NOVEDADES: NovedadFormacion[] = [
  (() => {
    const ref = findLeccion(
      "habana",
      "Camarero — protocolo de sala",
      "Atención al cliente VIP",
    );
    return {
      id: "n-h-1",
      tipo: "leccion",
      titulo: "Nueva lección: Atención al cliente VIP",
      descripcion:
        "Subida por RRHH. Recomendada para todos los camareros antes del fin de semana.",
      audiencia: ["CAMARERO"],
      fechaPublicacion: "2026-04-26",
      autor: "RRHH",
      empresaId: "habana",
      cursoId: ref?.cursoId,
      leccionId: ref?.leccionId,
    };
  })(),
  {
    id: "n-h-2",
    tipo: "tarea",
    titulo: "Tarea: completar el curso de Bienvenida",
    descripcion:
      "Recordatorio para todo el equipo: terminar el curso antes del 10 de mayo.",
    audiencia: "todos",
    fechaPublicacion: "2026-04-23",
    autor: "Dirección",
    empresaId: "habana",
    cursoId: habana.cursos.find(
      (c) => c.titulo === "Bienvenida a Balles Hosteleros",
    )?.id,
  },
  (() => {
    const ref = findLeccion(
      "habana",
      "Camarero — protocolo de sala",
      "Cobro, propinas y arqueo",
    );
    return {
      id: "n-h-3",
      tipo: "cambio",
      titulo: "Actualizado el protocolo de cierre de caja",
      descripcion:
        "Cambia la hoja de arqueo. Mira la lección actualizada y aplícala desde hoy.",
      audiencia: ["CAMARERO", "JEFE DE SALA"],
      fechaPublicacion: "2026-03-30",
      autor: "Gerencia",
      empresaId: "habana",
      cursoId: ref?.cursoId,
      leccionId: ref?.leccionId,
    };
  })(),
  {
    id: "n-h-4",
    tipo: "aviso",
    titulo: "APPCC — repasar antes de la inspección",
    descripcion:
      "La inspección llega en mayo. Todos repasamos el curso de Seguridad e Higiene.",
    audiencia: "todos",
    fechaPublicacion: "2026-04-18",
    autor: "Calidad",
    empresaId: "habana",
    cursoId: habana.cursos.find(
      (c) => c.titulo === "Seguridad e higiene en hostelería",
    )?.id,
  },
  {
    id: "n-h-old",
    tipo: "aviso",
    titulo: "Aviso antiguo (no debería aparecer)",
    descripcion: "Esta novedad tiene más de 3 meses y queda archivada.",
    audiencia: "todos",
    fechaPublicacion: "2025-11-01",
    autor: "RRHH",
    empresaId: "habana",
  },
  (() => {
    const ref = findLeccion(
      "bacanal",
      "Camarero VIP — Bacanal",
      "Protocolo de mesa reservada",
    );
    return {
      id: "n-b-1",
      tipo: "leccion",
      titulo: "Subido: Protocolo VIP — Bacanal",
      descripcion: "Lección nueva del jefe de sala. 9 min, vedla esta semana.",
      audiencia: ["CAMARERO", "JEFE DE SALA"],
      fechaPublicacion: "2026-04-08",
      autor: "RRHH",
      empresaId: "bacanal",
      cursoId: ref?.cursoId,
      leccionId: ref?.leccionId,
    };
  })(),
  (() => {
    const ref = findLeccion(
      "bacanal",
      "Contable — cierres del mes",
      "Exportar a gestoría",
    );
    return {
      id: "n-b-2",
      tipo: "cambio",
      titulo: "Cambio en cierres contables",
      descripcion: "Lección actualizada. Aplicar desde abril.",
      audiencia: ["CONTABLE", "GERENTE"],
      fechaPublicacion: "2026-03-12",
      autor: "Contabilidad",
      empresaId: "bacanal",
      cursoId: ref?.cursoId,
      leccionId: ref?.leccionId,
    };
  })(),
];

export function buildSeed(): {
  cursos: Curso[];
  secciones: Seccion[];
  lecciones: Leccion[];
  novedades: NovedadFormacion[];
} {
  return {
    cursos: [...habana.cursos, ...bacanal.cursos],
    secciones: [...habana.secciones, ...bacanal.secciones],
    lecciones: [...habana.lecciones, ...bacanal.lecciones],
    novedades: NOVEDADES,
  };
}

export const FECHA_HOY = HOY;
