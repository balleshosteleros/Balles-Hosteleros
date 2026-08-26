---
name: Ajustes es una BARRERA de permisos — nunca enlazar desde un módulo
description: El permiso de un departamento no abre sus Ajustes. Prohibido poner enlaces a Ajustes dentro de un módulo; el engranaje se queda aunque esté vacío
type: feedback
---

Complementa a [Ajustes vs Configuración](ajustes_vs_configuracion_y_diseno.md), que
define **dónde va cada cosa**. Esto define **quién puede llegar**, y es fácil de
romper sin darse cuenta.

Definición canónica dada por Iván:

> «Engranaje es **Configuración** y vive dentro de los departamentos, donde puede
> acceder **cualquier usuario con permiso** [a ese departamento]. Y **Ajustes** es
> una **barrera más alta de seguridad**, que contiene los ajustes internos de cada
> departamento: en la pestaña de Departamentos están los ajustes **más importantes
> y más delicados**, a los que **nadie puede acceder sin permiso a Ajustes**.»

O sea: **son dos llaves distintas.** Tener permiso a un departamento NO da acceso a
sus ajustes delicados. Quien entra a Pagos no tiene por qué entrar a Ajustes.

## Reglas que se derivan

- **NUNCA poner en un módulo un enlace o botón que lleve a Ajustes.** Aunque sea
  «solo un acceso directo», salta la barrera: convierte el nivel protegido en
  alcanzable desde el uso diario.
- **El engranaje SE QUEDA aunque esté vacío.** Es estructura del módulo, no algo
  que se pone y se quita. Si no tiene nada dentro, se muestra el panel con «No hay
  configuración propia por ahora» — nunca un enlace a Ajustes.
- **Cuando un ajuste sube a Ajustes, desaparece del módulo por completo.** No se
  duplica el formulario (dos sitios guardando lo mismo acaban divergiendo) ni se
  deja un puntero.

**Why:** el nivel global queda protegido por un permiso mayor. Un atajo bien
intencionado anula esa protección.

**How to apply:** al mover un ajuste a Ajustes, borrarlo del módulo y dejar el
engranaje con el panel vacío. Al revisar un módulo, comprobar que no hay ningún
`href`/botón hacia Ajustes.

Errores ya cometidos (agosto 2026), los dos en Pagos:
1. Al mover el envío de nóminas a la gestoría a Ajustes, se dejó en el engranaje
   una tarjeta con un botón «Abrir en Ajustes» → saltaba la barrera de permisos.
2. Al corregirlo, se quitó también el engranaje entero «porque ya no configuraba
   nada» → mal: el engranaje es estructura del módulo y se queda vacío.

Resultado correcto: engranaje presente, panel con «No hay configuración propia por
ahora», y CERO enlaces a Ajustes.
