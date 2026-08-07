# Lote 07-ago-2026 — registro de stock sumado por albarán (para revert opcional)

> Los 10 albaranes del lote (31/07, Bacanal+Habana) se confirmaron POR LA APP con el motor
> del PRP-073, así que **sumaron stock de verdad** (a diferencia de los lotes anteriores,
> cargados "Confirmado sin stock"). Si Iván prefiere dejarlos como los lotes viejos, este
> es el registro exacto de lo que habría que revertir: borrar los movimientos de
> `stock_movimientos` con `documento_tipo='albaran'` y `documento_id` del albarán, y
> restar el delta del `stock.cantidad_actual` de cada producto. **Los precios NO se tocan.**
> Alternativa nativa: inventario de regularización (Logística → Inventarios).


## BACANAL

### ALB-2026-053 — DITHER (nº prov. 26001069, 2026-07-31)
Albarán `8e9ec5fc-5271-4b80-91a8-e4ec96c21d2d` · estado Confirmado · creador Agora Demo

| Producto | Δ stock |
|---|---|
| Aguacate | +1.110 |
| Cebolla blanca | +1.450 |
| Cebolla roja | +1.270 |
| Cebollino | +2.000 |
| Cilantro | +1.000 |
| Hierbabuena | +3.000 |
| Lechuga romana | +2.000 |
| Patata Agria | +25.000 |
| Tomate Cherry | +1.080 |

### ALB-2026-054 — ENCINAR DE HUMIENTA (nº prov. H2026_15.489, 2026-07-31)
Albarán `4a40116a-230f-44b4-9a5a-33b1a9945446` · estado Confirmado · creador Agora Demo

| Producto | Δ stock |
|---|---|
| Entraña de ternera (350GR) | +4.340 |
| Hamburguesa artesana angus ( 200 gr) | +4.800 |
| Lomo bajo frisona ( 350 gr ) | +5.440 |
| Panceta adobada | +4.830 |

### ALB-2026-055 — MAHOU (nº prov. 98543/5, 2026-07-31)
Albarán `dc00ed8d-f5ba-4c69-9065-4e794df8e05c` · estado Confirmado · creador Agora Demo

| Producto | Δ stock |
|---|---|
| Alhambra Reserva 0,30 RET | +3.000 |

### ALB-2026-056 — KRITTIKALI (nº prov. 263893, 2026-07-31)
Albarán `48d81d92-58b1-47e3-ada2-0352dda9ed63` · estado Confirmado · creador Agora Demo

| Producto | Δ stock |
|---|---|
| Ambientador Sandia | +1.000 |
| Bayeta microfibra | +1.000 |
| Bobina Film | +2.000 |
| Bolsa Basura (115X150) | +2.000 |
| Estropajo Salvauñas | +1.000 |
| Lavavajillas manual | +1.000 |

## HABANA

### ALB-2026-018 — Coca-Cola Europacific Partners (nº prov. 4535606566, 2026-07-31)
Albarán `7e7449e8-4f5f-4ee9-acac-fd7a0934aff9` · estado Confirmado · creador Iván Ballesteros

| Producto | Δ stock |
|---|---|
| Cocacola | +2.000 |
| Fanta Limon | +2.000 |
| Sprite | +1.000 |
| Tonica Nordic | +1.000 |

### ALB-2026-019 — DITHER (nº prov. 26001070, 2026-07-31)
Albarán `db3ae320-a52f-43de-86fe-9ceb59acfdff` · estado Confirmado · creador Agora Demo

| Producto | Δ stock |
|---|---|
| Azucar | +2.000 |
| Azucar Moreno | +1.000 |
| Canela Polvo | +1.000 |
| Canela Rama | +1.000 |
| Fresas | +6.000 |
| Hierbabuena | +5.000 |
| Leche Asturiana | +6.000 |
| Limas | +6.550 |
| Limones | +5.340 |
| Mango | +1.280 |
| Naranjas | +3.820 |
| Nescafe | +1.000 |
| Phisalis | +1.000 |
| Piña | +3.910 |
| Platanos | +3.270 |
| Romero | +2.000 |
| Sandia | +6.580 |
| Zumo Naranja | +2.000 |
| Zumo Piña | +3.000 |

### ALB-2026-020 — BIGGER (nº prov. 025014422, 2026-07-30)
Albarán `b8ba7aa7-3f8c-4223-a156-96ef2fb2f4e1` · estado Confirmado · creador Agora Demo

| Producto | Δ stock |
|---|---|
| Clear Little Mix | +3.000 |
| Cubo Coctel Mix | +2.000 |
| Mini besos fresa | +3.000 |
| Mix goma pica | +3.000 |

### ALB-2026-021 — MAHOU (nº prov. 98544/5, 2026-07-31)
Albarán `7acc058a-3269-4034-900d-7f8eed106c84` · estado Confirmado · creador Agora Demo

| Producto | Δ stock |
|---|---|
| Alhambra Reserva 0,30 RET | +2.000 |
| Alhambra Reserva 0,30 RET | +1.000 |

### ALB-2026-022 — KRITTIKALI (nº prov. 263894, 2026-07-31)
Albarán `dbb9eaa3-bad1-4bc3-a759-9117906eea6b` · estado Confirmado · creador Agora Demo

| Producto | Δ stock |
|---|---|
| Bolsa Basura (115X150) | +3.000 |
| Copa Squall Hurricane 44cl (Libbey) | +6.000 |
| Fregona Microfriba | +3.000 |
| Limpiacristales | +1.000 |
| Rollo Termico (80x80x12) | +1.000 |

### ALB-2026-023 — DDI NEXIA (nº prov. 829045492, 2026-07-31)
Albarán `64e250bf-d5bb-4720-9524-bc33377a9241` · estado Confirmado · creador Agora Demo

| Producto | Δ stock |
|---|---|
| Señorio de Lizia Verdejo Rueda 75cl | +12.000 |

---

Generado automáticamente el 2026-08-07 tras confirmar el lote. Movimientos totales: 55.
