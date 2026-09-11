import type { ArticuloManual } from "./tipos";

/**
 * Módulos pequeños y los ajustes del software.
 *
 * AJUSTES va aparte de los departamentos: no es un departamento, es la
 * configuración del software. Solo lo ve quien tiene ese permiso, así que estos
 * artículos no los recupera un empleado corriente.
 */
export const MANUAL_OTROS: ArticuloManual[] = [
  // ─── JURÍDICO ───────────────────────────────────────────────────────────
  {
    ref: "sw:juridico-procesos",
    modulo: "JURÍDICO",
    titulo: "Procesos legales",
    contenido: `En Jurídico, Procesos se lleva cada asunto legal abierto, con su estado, sus plazos y su documentación.`,
    ruta: "/juridico/procesos",
    rutaTitulo: "Procesos",
  },

  // ─── PRODUCTO (solo la empresa matriz) ──────────────────────────────────
  {
    ref: "sw:producto-pipeline",
    modulo: "PRODUCTO",
    titulo: "Producto: pipeline, clientes, citas y escuela",
    contenido: `Producto es el módulo interno de la empresa que gestiona el propio software. No existe en las empresas cliente.

Tiene el pipeline comercial, los clientes del software, las citas y la escuela de formación con su portal de alumnos.`,
    ruta: "/producto/pipeline",
    rutaTitulo: "Pipeline",
  },

  // ─── AJUSTES ────────────────────────────────────────────────────────────
  {
    ref: "sw:ajustes-donde",
    modulo: "AJUSTES",
    titulo: "Dónde está cada ajuste",
    contenido: `Ajustes se abre con el icono de arriba de la aplicación.

Dentro, casi todo se organiza igual: Departamentos, se entra en el departamento al que pertenece la cosa que quieres tocar, y dentro se busca su módulo. Ahí está su configuración.

Lo que no pertenece a ningún departamento (las herramientas generales del software) está en Ajustes, Herramientas.

Todo lo que sea conectar el software con algo de fuera va en Ajustes.

Ajustes no lo ve cualquiera: hace falta tener ese permiso concedido expresamente en el rol.`,
    ruta: "/ajustes",
    rutaTitulo: "Ajustes",
  },
  {
    ref: "sw:ajustes-roles",
    modulo: "AJUSTES",
    titulo: "Roles y permisos: quién ve qué",
    contenido: `En Ajustes, Roles se decide qué ve y qué puede editar cada rol, módulo por módulo.

Lo que manda es el permiso configurado, no la etiqueta del rol. Ser "dirección" no abre puertas por sí solo: las abre tener el permiso puesto.

Los roles son los mismos en todas las empresas del grupo: un rol se asigna una vez y queda una fila por empresa.

Si a alguien se le queda el menú vacío, lo normal es que su usuario se haya quedado sin rol.`,
    ruta: "/ajustes",
    rutaTitulo: "Ajustes",
  },
  {
    ref: "sw:ajustes-usuarios",
    modulo: "AJUSTES",
    titulo: "Usuarios y accesos",
    contenido: `En Ajustes, Usuarios se gestiona quién entra en el software.

El acceso va con el correo del usuario: si se le cambia el correo, cambia su forma de entrar.

Las altas son por invitación: se manda un correo y la persona elige su contraseña. No se reparten contraseñas hechas.

Un usuario no es lo mismo que un empleado: puede haber usuarios sin ficha de empleado.`,
    ruta: "/ajustes",
    rutaTitulo: "Ajustes",
  },
  {
    ref: "sw:ajustes-empresas-locales",
    modulo: "AJUSTES",
    titulo: "Empresas, locales y datos fiscales",
    contenido: `En Ajustes se configuran las empresas del grupo, sus datos fiscales y sus locales.

Los datos fiscales son de la EMPRESA; el centro de trabajo y su código de cuenta de cotización son del LOCAL. La gestoría necesita los dos.

Cada empresa tiene su zona horaria configurada, y es la que manda para todas las horas que se enseñan.

Los locales llevan además la configuración de fichaje, con su geolocalización.`,
    ruta: "/ajustes",
    rutaTitulo: "Ajustes",
  },
  {
    ref: "sw:ajustes-correo",
    modulo: "AJUSTES",
    titulo: "Correo: conectar un buzón",
    contenido: `Los buzones de correo se conectan desde Ajustes, y la conexión es de la EMPRESA, no de quien la hace: si mañana esa persona se va, el buzón sigue conectado.

Los correos van por departamento. El software manda sus avisos desde su propia dirección de envío.`,
    ruta: "/ajustes",
    rutaTitulo: "Ajustes",
  },
  {
    ref: "sw:ajustes-archivos",
    modulo: "AJUSTES",
    titulo: "Archivos y almacenamiento",
    contenido: `Archivos es el disco de la empresa dentro del software, organizado por carpetas.

Cada empresa tiene su espacio y su cuota, y no ve el de las demás.

Un archivo suelto puede pesar hasta 50 MB.`,
  },
];
