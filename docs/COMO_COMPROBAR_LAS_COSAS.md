# Cómo comprobar las cosas (para el Claude de Iván)

> **De:** Fernando · **Fecha:** 2026-09-12
> Iván comenta que su Claude no recuerda de una sesión a otra y que no comprueba cosas
> por su cuenta. He mirado el repositorio. Aquí está lo que he encontrado y lo que falta.

---

## 1. Lo que más se nota: no sabe que puede mirar la base de datos real

**Este es el hueco grande.** El `CLAUDE.md` no menciona en ningún sitio que se puede
consultar la base de datos de producción. Así que su Claude solo puede **leer el código y
deducir**, que es otra forma de decir suponer.

La diferencia entre las dos formas de trabajar es entera:

| Leyendo el código | Mirando producción |
|---|---|
| «esta columna debería existir» | «esta columna existe / no existe» |
| «esto debería haberse aplicado» | «esto se aplicó el día 9» |
| «creo que hay unos cuantos» | «hay 49, en 17 productos, y son estos» |

**Ya tenéis el permiso para hacerlo.** El token vive en vuestro `.env.local`
(`SUPABASE_ACCESS_TOKEN`), el mismo fichero de siempre. Solo faltaba la herramienta, y la
dejo hecha:

```bash
bash scripts/sql-produccion.sh -c "select count(*) from productos;"
bash scripts/sql-produccion.sh consulta.sql
```

### La costumbre que lo cambia todo: ensayar antes de tocar

Cuando hay que **escribir** en producción (una migración, un arreglo de datos), la regla
de la casa es probarlo primero dentro de una transacción que se deshace sola:

```sql
begin;
  -- ...la migración entera...
  select count(*) from lo_que_sea;   -- ¿ha hecho lo que esperábamos?
rollback;                            -- y no queda nada
```

No es teoría. Esta semana ese ensayo cazó dos fallos antes de tocar un solo dato:

- Una prueba dio **140 donde esperaba 137**. No era un fallo del código: era que el dato
  con el que yo comparaba tenía dos días y el TPV había seguido vendiendo.
- Otra reveló que un recuento **se traga cualquier apunte anterior a él**. Es la regla
  correcta —lo que se contó ya incluía esa entrega— pero es un cambio de comportamiento
  que había que explicar antes de soltarlo.

---

## 2. Tampoco sabe comprobar si un despliegue ha fallado

El `CLAUDE.md` habla de desplegar, pero no de **mirar si salió bien**. Con esto se ve:

```bash
gh api repos/balleshosteleros/Balles-Hosteleros/commits/HEAD/status --jq .state
```

Devuelve `success`, `failure` o `pending`. Hoy hemos visto cinco despliegues fallidos
seguidos de anoche que se arreglaron solos con los commits siguientes — pero eso hay que
**mirarlo**, no suponerlo.

> Detalle que importa: `next.config.ts` **no** lleva `ignoreBuildErrors`, así que un
> despliegue verde significa de verdad que el código compila y pasa el lint. Eso hace que
> el semáforo sea fiable.

---

## 3. La memoria sí existe y sí está enganchada — pero se le cuelan fichas

El sistema está bien montado: `CLAUDE.md` dice en su línea 7 que hay que leer
`.claude/memory/MEMORY.md` al empezar, y ese índice tiene 57 fichas bien escritas.

**El problema es otro: 8 fichas no están nombradas en el índice.** Y una ficha que el
índice no nombra **no la abre nadie nunca** — se escribió para nada.

Son estas:

```
feedback/rol_director_bypass.md
project/accesos_apps.md
project/boarding_modulo_eliminado.md
project/escandallos_revision_borja_cerrada_2026-09-08.md
project/fichajes_tabla.md
project/modelos_aeat.md
project/pedidos_migracion_uuid.md
project/reservas_vinculacion_solo_duda_identidad.md
```

Fijaos en la cuarta: es la nota del cierre de la revisión con Borja, escrita el 8 de
septiembre y titulada *«Nota para Fernando»*. **Ni su Claude ni el mío la abrirían jamás**
— yo la encontré de casualidad leyendo los commits.

> **Arreglo:** una línea por ficha en `MEMORY.md`, con el enlace y una frase de qué
> contiene. Y al escribir una ficha nueva, añadir siempre su línea al índice en el mismo
> momento.

### Y una diferencia que conviene conocer

Mi memoria **se carga sola** al empezar cada sesión: la tengo fuera del repositorio, en mi
propia carpeta, y me llega puesta sin hacer nada.

La vuestra está **dentro del repositorio**, que tiene la ventaja enorme de que se comparte
por git —por eso yo puedo leer vuestras decisiones—, pero depende de que Claude **decida**
abrir el fichero porque el `CLAUDE.md` se lo pide. Si la primera petición de la sesión es
una tarea concreta, es fácil que se salte ese paso y arranque sin contexto.

Es exactamente la sensación de «no se acuerda de nada».

> **Arreglo:** empezar la sesión con un «hola» o un «ponte al día» antes de pedir la
> primera tarea. Vuestro propio `CLAUDE.md` ya tiene la costumbre puesta
> (*«Hola = Pull / Adiós = Push»*); vale igual para la memoria.

---

## 4. El `CLAUDE.md` lleva cinco meses sin tocarse

Última modificación real: **14 de abril**. Desde entonces el software ha cambiado
muchísimo — todo el almacén con historial, el cierre, Ágora, los escandallos — y el manual
sigue describiendo el proyecto de abril.

No es que esté mal escrito; es que ya no cuenta lo que hay. Un manual desactualizado no es
neutral: **manda a Claude en la dirección equivocada con toda la confianza del mundo**.

---

## Resumen: tres cosas y el orden

1. **Enseñarle a mirar producción.** Es lo que más cambia, y la herramienta ya está puesta
   (`scripts/sql-produccion.sh`). Basta con añadirlo al `CLAUDE.md` para que sepa que
   existe.
2. **Indexar las 8 fichas sueltas**, y no volver a escribir una ficha sin su línea.
3. **Repasar el `CLAUDE.md`** para que describa el software de hoy.

Con lo primero solo, la diferencia ya se nota: se pasa de «creo que» a «he mirado y es
así».
