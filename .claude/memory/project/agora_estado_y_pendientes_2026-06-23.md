---
name: Estado del frente Ágora y pendientes para el equipo (cierre 2026-06-23, lado Fernando)
description: Resumen de lo trabajado en la integración Ágora desde el lado de Fernando el 23-jun y los 3 frentes que requieren acción del equipo/Iván — crons, recetas y botón de precios. Punto de entrada a las fichas detalle
type: project
---

**Resumen para el equipo / agente de Iván — jornada 2026-06-23 (lado Fernando; solo lectura sobre la BD/Ágora + un cron en GitHub Actions; NO se tocó `src/` salvo nada).**

## Lo que está hecho y funcionando ✅
- **Ventas Ágora→Balles**: fluyen a diario; conector multi-tenant (PRP-059) migrado, Habana y Bacanal con credenciales de Ágora cifradas en BD (`agora_activo` + `agora_api_*`).
- **Cron de ventas**: se estaba **parando** (Vercel no dispara fiable los crons — plan Hobby, 16 crons, horas dispersas; se saltó el 22-23). Montado un **disparador externo en GitHub Actions** (`.github/workflows/agora-sync-cron.yml`, 09:37 UTC) con `CRON_SECRET` en GitHub Secrets. Recuperados a mano los días 21-22 que faltaban (**44 facturas**). El cron de Vercel sigue en `vercel.json` (idempotente, no molesta).

## 3 frentes que requieren acción del equipo ⏳
1. **Crons de Vercel no fiables** → los **otros 15 crons** (fichajes, reseñas, recordatorios de reserva, points, firmas, rwg, vacantes…) siguen sin disparador fiable. Fix de fondo: **Vercel Pro** o **ampliar el workflow de GitHub Actions a los 16** endpoints y vaciar `crons` en `vercel.json`. → [[crons_vercel_no_se_disparan]]
2. **Recetas triviales 1:1** → el descuento de stock de **platos** NO es fiable (las 208 recetas reales multi-ingrediente se perdieron en la migración del Excel; quedan 203 triviales 1:1; bebidas OK, platos no). **DECISIÓN: incorporar el BACKUP DEL EXCEL** de las recetas a `producto_composicion`. **No poner `empresas.stock_descuento_desde`** (armar el descuento) hasta entonces. → [[recetas_triviales_no_armar_descuento]]
3. **Botón de precios Balles→Ágora** → **VALIDADO end-to-end** en producción (cambio real reversible 471,50→471,51→471,50 €). **Falta construir la feature** (server action `enviarPreciosAgora` + UI botón en logística/productos). Es **zona de Iván** → coordinar. Enfoque "leer y devolver" + escollos resueltos en → [[envio_precios_agora_validado]]

Detalle técnico completo del manual + la API en `docs/AGORA_INTEGRACION_ESTADO_Y_PLAN.md`. Reglas: [[regla_oro_balles_fuente_verdad]], [[agora_ingesta_habana_bacanal_aislada]].
