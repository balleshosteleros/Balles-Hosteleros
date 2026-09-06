# Auditoría del módulo GERENCIA — 06/09/2026

Estado verificado contra código + base de datos de producción. Pendiente de arreglar.

## Roto de verdad (no funciona nada)

1. **Comunicados enseña un MOCK, nunca la BD.** `ComunicadosView.tsx:615-630`: llama a
   `listComunicados()`, tira el resultado y pinta `getComunicadosByEmpresa()`
   (`src/features/rrhh/data/comunicados.ts`, datos inventados). Las 3 ramas (ok / vacío /
   catch) hacen lo mismo. Hay **23 comunicados reales en BD que nadie ve**. El usuario
   guarda, sale "Comunicado guardado" y su comunicado no aparece.
   El mock solo conoce "habana" y "bacanal": otra empresa ve la lista vacía.
   Los KPIs ("alcance medio 85 %") son cifras inventadas.

2. **Sanción disciplinaria SIEMPRE falla.** `SancionDisciplinariaView.tsx:233` manda
   `e.userId` (= `usuarios.user_id`, id de auth) y el servidor busca por `empleados.id`
   (`sancion-disciplinaria-actions.ts:96`). Verificado en BD: **0 de 28 empleados** tienen
   `id` que coincida con un `user_id`, y hay **0 sanciones emitidas** en la historia.
   Siempre sale "Trabajador no encontrado". Ver [[empleado_vs_usuario]].

3. **Ratios son datos falsos.** `RatiosView.tsx` lee `src/features/rrhh/data/ratios.ts`:
   semana congelada del 30/03/2026, sueldos/hora y facturación escritos a mano. Las flechas
   de semana y las pestañas Día/Mes/Trimestre no hacen nada. Viola
   [[cero_calculado_vs_sin_calcular]] y [[datos_completos_obligatorio]].

## Números que mienten

4. **KPIs de Cierres cuentan retiradas e ingresos como si fueran cierres.**
   `CierresView.tsx:497-503`. El backend fuerza `cuadra=true, descuadre=0` en retiradas e
   ingresos, así que todas cuentan como "cuadran". Datos reales: la pantalla dice
   **33 cierres / 27 cuadran**; la verdad es **14 cierres / 8 cuadran** (82 % falso vs 57 % real).

5. **Columna "Acumulado" desordenada cuando hay varios apuntes el mismo día.**
   `CierresView.tsx:510-518` hace `.reverse()` sobre un listado ordenado solo por `fecha`
   (`cierres-actions.ts:291`), sin desempate por `created_at`. Hay **9 fechas con varios
   movimientos** (una con 8): el gerente puede ver saldos negativos que nunca existieron.
   Arreglo: añadir `.order("created_at")` en `listCierres`.

6. **Margen de Ventas inflado.** `ventas-actions.ts` usa `productos.coste` (columna de tipo
   TEXTO). 32 de 226 productos vendidos no tienen coste → **20.646 € (16,6 % de los ingresos)
   se computan con coste 0** e inflan el margen; esos platos salen como "ESTRELLA" falsos.
   Además resta costes de LÍNEAS a ingresos de TICKETS, que difieren en 3.749 € (3 %).

## Vencimientos (obligaciones legales)

7. **Fecha de próxima revisión mal calculada.** `vencimientos-actions.ts:44-49`
   (`setMonth`): 31/01 + 1 mes da **2 de marzo**, no el 28 de febrero → se pasa el plazo legal.
   Y `toISOString()` resta un día si el servidor no corre en UTC (15/06 + 1 mes = 14/07 en
   hora de Madrid). Ver [[zona_horaria_por_empresa]].
8. `VencimientosView.calcularEstado` decide VENCIDA con `new Date()` del NAVEGADOR.
9. Las 60 revisiones sembradas están **todas sin fecha y sin responsable**, y solo en
   BACANAL y HABANA (falta la tercera empresa).
10. `revisiones`, `revisiones_historial` y `vencimientos_documentos` tienen `empresa_id` de
    tipo **TEXT**; el resto del sistema lo tiene UUID.

## Seguridad / aislamiento

11. `updateComunicado`, `deleteComunicado`, `updateIncidencia` y `addActualizacion` **no
    filtran por `empresa_id`**: van solo por `id`. Hoy el RLS tapa el agujero, pero solo
    mientras viaje la cabecera `x-bh-empresa`; si falta la cookie, `empresas_del_usuario()`
    abre a TODAS las empresas del usuario. Ver [[aislamiento_empresa_activa_no_lo_da_la_rls]].
12. `listComunicados` y `listMantenimiento` hacen `if (empresaId) query.eq(...)`: si no se
    resuelve la empresa **no filtran nada** en vez de no devolver nada.
13. Solo `cierres` y `sanciones` comprueban permiso de escritura (`puedeEditarModulo`).
    Comunicados, mantenimiento, vencimientos e informes no piden permiso en el servidor.

## Normas de UI incumplidas

- Fechas en formato prohibido: `ComunicadosView` (800, 806) las pinta crudas (`2026-03-28`);
  `CierresView` usa "05 sept 2026" en 6 sitios. Regla: [[fechas_siempre_dia_mes_ano]].
- `VentasView` fecha TODO el panel con `new Date().toISOString()` (UTC): el preset "Hoy"
  enseña el día equivocado. Es el antipatrón que la norma nombra por su nombre.
- Botones que no hacen nada: menú Duplicar/Programar/Archivar/**Eliminar** sin `onClick`
  (`ComunicadosView:913-916`); barra de negrita/cursiva del editor (`:252-259`);
  "Adjuntar documento" inventa `documento_1.pdf` y no sube nada (`:413-415`).
- Roles destinatarios de una lista inventada a mano (`ComunicadosView:77-81`), no de
  `empresa_roles`: si el rol real se llama distinto, **el comunicado no le llega a nadie**.
- `REPARADORES` sigue siendo mock (`empresa/data/mantenimiento.ts:46`).
- Engranaje de configuración visible en móvil en Cierres y Comunicados.
- Dinero con `<Input type="number">` y `placeholder="0.00"` (punto) en `CierresView`
  (1651, 1688, 1858); el parseo `.replace(",",".")` convierte "1.234,50" en **0 €** sin avisar.
- Ni Comunicados ni Mantenimiento muestran indicador de carga: `const [, setLoading]`.

## Tamaño (CLAUDE.md: 500 líneas/fichero, 50/función)

`CierresView.tsx` 2371 líneas (una sola función de 2086) · `ComunicadosView.tsx` 947 ·
`VentasView.tsx` 760 · `VencimientosView.tsx` 720 · `MantenimientoView.tsx` 613 ·
`cierres-actions.ts` 985.

## Lo que SÍ está bien

Cierres (backend): guardia de saldo no negativo, bloqueo de apuntes fuera de plazo en zona
horaria de empresa, permisos y validación de descuadre. Vencimientos y sanciones (backend)
filtran bien por empresa. Ojo: `deleteCierre` valida el plazo pero **no** el saldo, así que
borrar un cierre puede dejar la caja acumulada en negativo.
