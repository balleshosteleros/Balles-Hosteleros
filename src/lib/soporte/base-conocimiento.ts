/**
 * Base de conocimiento estática (mock) para la ayuda rápida.
 *
 * Cuando se cree la tabla `base_conocimiento` en Supabase, este módulo
 * leerá de allí. Por ahora vive en código para que la UX funcione end-to-end.
 */

export type ArticuloBase = {
  id: string;
  pregunta: string;
  palabras_clave: string[];
  respuesta: string;
  video_url?: string;
  fuente?: string;
};

export const BASE_CONOCIMIENTO: ArticuloBase[] = [
  {
    id: "fichar-entrada",
    pregunta: "Cómo fichar la entrada",
    palabras_clave: ["fichar", "fichaje", "entrada", "entrar", "empezar turno"],
    respuesta:
      "Para fichar la entrada:\n\n1. Abre el módulo Recursos Humanos → Fichajes.\n2. Pulsa el botón verde grande FICHAR ENTRADA.\n3. Verás tu hora de inicio en pantalla.\n\nSi no estás en tu sitio de trabajo el fichaje no se acepta. Habla con tu responsable si tienes problemas con la geolocalización.",
    video_url: "https://www.youtube.com/results?search_query=como+fichar+entrada+sesame",
    fuente: "Manual RRHH · Fichajes",
  },
  {
    id: "fichar-salida",
    pregunta: "Cómo fichar la salida",
    palabras_clave: ["salida", "salir", "terminar", "fin turno"],
    respuesta:
      "Para fichar la salida:\n\n1. Recursos Humanos → Fichajes.\n2. Pulsa FICHAR SALIDA.\n3. Confirma la hora.\n\nSi olvidas fichar avisa a tu responsable lo antes posible para que lo regularice.",
    fuente: "Manual RRHH · Fichajes",
  },
  {
    id: "subida-precio-proveedor",
    pregunta: "Qué hacer si un proveedor sube el precio",
    palabras_clave: [
      "subida",
      "precio",
      "proveedor",
      "encarece",
      "incremento",
      "incidencia",
    ],
    respuesta:
      "Cuando un proveedor te avisa de una subida de precio:\n\n1. Ve a Logística → Incidencias.\n2. Pulsa Nueva subida.\n3. Indica producto, proveedor, precio actual y precio nuevo.\n4. Si la subida es mayor del 10% el sistema te avisa en rojo y debes escalarlo a tu responsable antes de aceptarla.",
    fuente: "Manual Logística · Incidencias",
  },
  {
    id: "anadir-empleado",
    pregunta: "Cómo dar de alta un empleado nuevo",
    palabras_clave: ["alta", "empleado", "nuevo", "contratar", "incorporar"],
    respuesta:
      "Para dar de alta un empleado:\n\n1. Recursos Humanos → Empleados.\n2. Pulsa + Nuevo empleado.\n3. Rellena nombre, apellidos, email, departamento y rol.\n4. Asigna jefe directo (importante: el jefe recibirá las dudas de soporte de este empleado).\n5. Guarda. El empleado recibirá un email para entrar al sistema.",
    fuente: "Manual RRHH · Empleados",
  },
  {
    id: "boarding",
    pregunta: "Cómo arrancar un onboarding nuevo",
    palabras_clave: ["onboarding", "boarding", "incorporación", "primer día"],
    respuesta:
      "El onboarding se gestiona desde Recursos Humanos → Boarding.\n\n1. Pulsa + Nuevo proceso.\n2. Selecciona empleado y plantilla (Cocina, Sala, Logística…).\n3. La plantilla se carga con todas las tareas a marcar.\n4. Cuando el empleado las completa, marca cada tarea hasta llegar al 100%.",
    fuente: "Manual RRHH · Boarding",
  },
  {
    id: "agenda",
    pregunta: "Dónde está el contacto del fontanero o de un proveedor",
    palabras_clave: ["agenda", "contacto", "teléfono", "fontanero", "proveedor"],
    respuesta:
      "Todos los contactos del holding están en la AGENDA (sidebar inferior).\n\nEstán organizados por categorías:\n• Mantenimiento (electricistas, frigoristas…)\n• Proveedores\n• Servicios\n• Emergencias\n• Otros\n\nPuedes llamar, mandar WhatsApp o email directamente desde la ficha.",
    fuente: "Manual General · Agenda",
  },
];

export function buscarBase(pregunta: string): ArticuloBase[] {
  const q = pregunta.toLowerCase();
  return BASE_CONOCIMIENTO.filter((a) =>
    a.palabras_clave.some((k) => q.includes(k.toLowerCase())),
  );
}
