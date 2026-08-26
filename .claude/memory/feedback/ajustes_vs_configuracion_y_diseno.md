---
name: Reglas AJUSTES vs CONFIGURACIÓN y coherencia visual
description: Texto literal de Iván — dónde va cada ajuste y regla crítica de diseño frontend. NO reformular ni resumir
type: feedback
---

> Texto escrito por Iván (2026-08-19). **Guardado literal: no modificar ni una letra.**

## Regla general de interpretación

A partir de ahora, siempre que se indique **“añade esto en Ajustes”** o **“mételo en Configuración”**, se deberá interpretar siguiendo estrictamente las reglas definidas a continuación.

### 1. Cuando se indique “Añádelo en AJUSTES”

Siempre se estará haciendo referencia al botón de **Ajustes generales**, accesible desde el **icono situado en la parte superior de la aplicación**.

Una vez dentro de Ajustes, se deberá seguir esta lógica:

1. Ir a **Departamentos**.
2. Identificar el **departamento al que pertenece la funcionalidad que estamos creando o modificando**.
3. Entrar dentro de ese departamento.
4. Localizar el **módulo correspondiente al tema o funcionalidad sobre la que estamos trabajando**.
5. Añadir dentro de ese módulo el nuevo ajuste solicitado.

Esta será la estructura habitual y se aplicará aproximadamente al **90 % de los casos**.

#### Excepción: Herramientas

Cuando la funcionalidad que se está creando **no pertenezca a ningún departamento**, sino que corresponda a una herramienta general del software, el recorrido será:

**Ajustes generales → Herramientas → Herramienta correspondiente**

Dentro de esa herramienta se incorporarán los ajustes necesarios.

Por tanto, cada vez que se indique **“mételo en Ajustes”**, antes de crear nada deberá determinarse automáticamente:

* Si pertenece a un **Departamento**.
* Qué departamento es.
* Qué módulo dentro de ese departamento corresponde.
* O, si no pertenece a Departamentos, qué **Herramienta** es la correspondiente.

---

### 2. Cuando se indique “Añádelo en CONFIGURACIÓN”

**Configuración** es diferente de **Ajustes**.

Cuando se indique que algo debe añadirse en **Configuración**, se estará haciendo referencia a la configuración interna del **módulo o submódulo concreto en el que estamos trabajando**.

Estas configuraciones forman parte del entorno operativo diario del usuario y su acceso dependerá de:

* Su usuario.
* Su rol.
* Su departamento.
* Los permisos que tenga asignados.

Son configuraciones de **menor importancia o alcance que los Ajustes generales**.

Siempre deberán incorporarse dentro del propio módulo o submódulo correspondiente.

Para mantener un patrón uniforme en toda la aplicación, **todos los módulos o submódulos que dispongan de Configuración deberán utilizar el mismo icono de engranaje situado en la parte superior derecha de la vista**.

Al pulsar dicho engranaje se accederá a la Configuración específica de ese módulo, y será ahí donde se incorporarán las opciones que se soliciten.

La estructura conceptual será siempre:

**Módulo/Submódulo de trabajo → Icono de engranaje superior derecho → Configuración del módulo**

---

## 3. Diferencia fundamental entre AJUSTES y CONFIGURACIÓN

**AJUSTES**
Son configuraciones generales, estructurales o de mayor importancia dentro del software.

Ruta habitual:

**Ajustes generales → Departamentos → Departamento → Módulo**

o, cuando corresponda:

**Ajustes generales → Herramientas → Herramienta**

**CONFIGURACIÓN**
Son configuraciones más concretas y operativas relacionadas directamente con el módulo o submódulo en el que trabaja el usuario.

Ruta:

**Módulo/Submódulo → Engranaje superior derecho → Configuración**

Esta diferencia deberá mantenerse siempre y no deberán mezclarse ambos conceptos.

---

## 4. Regla crítica de diseño y frontend

Es **vital mantener siempre la coherencia visual del software**.

Nunca se deberá modificar, reinventar o romper el patrón visual existente al desarrollar nuevas funcionalidades.

Antes de crear cualquier nueva pantalla, configuración, modal, botón, apartado o funcionalidad, se deberá observar el diseño existente y reproducir exactamente su lógica visual.

Debe mantenerse siempre el mismo patrón en:

* Botones.
* Tamaños de botones.
* Espaciados.
* Márgenes.
* Tamaños de texto.
* Tipografías.
* Pesos de las fuentes.
* Encabezados.
* Subencabezados.
* Iconos.
* Posición de los elementos.
* Tarjetas.
* Bordes.
* Radios.
* Campos de formulario.
* Selectores.
* Modales.
* Tablas.
* Menús.
* Distribución de contenidos.
* Jerarquía visual.
* Comportamiento responsive.
* Estados hover, activos o seleccionados.
* Cualquier otro componente existente en el frontend.

### Principio obligatorio

**Nunca crear un estilo nuevo si ya existe un patrón equivalente dentro del software.**

Siempre se deberá reutilizar el lenguaje visual, componentes y estructura existentes para que cualquier nueva funcionalidad parezca haber formado parte del sistema desde el principio.

La prioridad será siempre:

**Consistencia > creatividad visual.**

Estas reglas deberán aplicarse automáticamente cada vez que se desarrolle, modifique o amplíe cualquier parte del proyecto.
