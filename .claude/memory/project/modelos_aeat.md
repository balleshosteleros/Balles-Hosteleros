---
name: Submódulo Modelos AEAT (Gestoría)
description: Estado y arquitectura del submódulo /gestoria/modelos que genera los 6 modelos oficiales AEAT con categorización IA
type: project
---

Submódulo `/gestoria/modelos` implementado (PRP-030, 2026-04-18) en régimen general IVA.

**Why:** sustituir asesoría externa (~1.500-3.000 €/año) permitiendo generar borradores oficiales de los 6 modelos AEAT directamente desde las facturas ya registradas, con categorización IA automática (Gemini free).

**How to apply:**
- Feature path: `src/features/gestoria/modelos/` (actions/components/data/services/types)
- Modelos soportados: **303, 130, 111, 115, 390, 347** (todos régimen general; sin recargo de equivalencia, sin 349 ni 202).
- BD (migración 041): `modelos_aeat`, `asignaciones_modelo`, `reglas_categorizacion_ia` + trigger `prevent_update_presentado` (inmutabilidad) + campo `iva_deducible_pct` en `facturas` + campos fiscales en `empresas`.
- Fuente de datos = tabla `facturas` (ya existente, migración 007). No duplicar.
- Separación IA/cálculo: la IA sólo escribe `asignaciones_modelo`; las casillas las calculan servicios puros `calculo-{303,130,111,115,390,347}.ts`.
- 390 se calcula desde los 4 trimestres 303 del mismo ejercicio (no requiere IA).
- 347 agrupa por NIF y filtra > 3.005,06 €/año (no requiere IA).
- Export: PDF vía HTML imprimible (`/api/modelos-aeat/[id]/pdf`) + fichero posicional Latin-1 (`/api/modelos-aeat/[id]/fichero`).
- Presentar → snapshot inmutable + hash SHA-256; trigger DB bloquea edición posterior.
- Cuadre automático: `validarCuadre()` compara casillas vs facturas, tolerancia 1 ct.
- Gemini rate limit: 15 RPM → batch de 100 facturas por llamada.
- Plazos (casilla rápida): 303/130/111/115 → día 20 del mes siguiente al trimestre (Q4 hasta 30-01); 390 → 30-01; 347 → 28-02.
- **Pendiente:** aplicar migración 041 manualmente en Supabase Studio > SQL Editor; completar datos fiscales de la empresa (NIF, razón social) en Ajustes antes de presentar.
