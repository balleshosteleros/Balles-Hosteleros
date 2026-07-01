# Precios de compra desde albaranes — 85 cargados + DECISIONES para Iván

> **De:** Claude (con Fernando) · **Para:** Iván · **Fecha:** 2026-07-01
> Tú conoces los productos y los restaurantes; **estos casos los decides tú**. Fernando me paró
> aquí a propósito para no meter criterio de producto que no me toca.

## Contexto
Fernando pasó las **17 fotos de los 11 albaranes reales** (18-19 jun, Bacanal + Habana: Makro, Garcimar,
Encinar, Antonio de Miguel, Belmon Drink, Serpeska, Dither, Mahou, Krittikali, DDI Nexia).
Extraídas **128 líneas** (14 documentos) con IA; **todos los totales cuadran** contra las cabeceras.
Emparejadas con el catálogo (612 productos de compra/elaboración) por 2 pasadas IA, con nivel de confianza.

## ✅ YA CARGADO en prod (85 precios de ALTA confianza) — NO recargar
`producto_precios_compra`: **Bacanal 41 + Habana 44**. Por proveedor: DITHER 32, BELMONTE 29,
KRITTIKALI 10, MAKRO 5, GARCIMAR 3, ANTONIO DE MIGUEL 3, ENCINAR DE HUMIENTA 3.
- **Cross-validado con `ingredientes_proveedor`**: en casi todas, el proveedor del albarán ya era el
  `es_preferido` de ese producto (Dither=fruta, Belmonte=bebidas, Encinar=carne…). Por eso son fiables.
- Método: `precio` = unitario del albarán; **IVA en `producto_precios_compra.iva`** (no en `productos.iva`);
  `fecha_inicio` = fecha del albarán; `proveedor` = nombre de catálogo en mayúsculas;
  `observaciones` = `Albarán <doc> (<proveedor>, carga desde foto 2026-07-01)`.
- También sincronizado `productos.precio_compra` (vigente). *Vieira media* quedó con 2 precios
  (Garcimar 13,11 + Makro 16,23) → el histórico multi-proveedor funciona.
- **Si no te cuadra algo y quieres revertir esta carga:**
  `delete from producto_precios_compra where observaciones like '%carga desde foto 2026-07-01%';`
- Nota de precio: **carne de Encinar y pescado de Makro van a €/kg** (correcto para escandallo por peso);
  **Mahou** venía con descuento → cargado el **efectivo** (Alhambra 20,41, no 31,89).

---

## ⚠️ PENDIENTE DE TU DECISIÓN

### A) Producto EXISTE pero el nombre difiere — ¿es el mismo o creamos ficha aparte?
| Línea albarán | Producto catálogo propuesto | Precio | IVA | Proveedor | Empresa |
|---|---|---|---|---|---|
| METRO Chef queso vaca-cabra rulo 1kg | **Queso de cabra** | 9,75 | 4% | MAKRO | Bacanal |
| PAN FRANKFURT BRIOCHE (85g×54u) | **Pan briocht** | 37,27/caja | 4% | ANTONIO DE MIGUEL | Bacanal |
| METRO Chef leche entera 1,5L (6u) | **Leche** | 9,28 (¿caja de 6?) | 4% | MAKRO | Bacanal |
| FUENTE LIVIANA 1/1 vidrio ret. | **Agua Fuenteliviana Grande** | 10,54 | 10% | DDI NEXIA | Bacanal |
| FUENTE LIVIANA 1/2 vidrio ret. | **Agua Fuenteliviana Pequeña** | 11,70 | 10% | DDI NEXIA | Bacanal |
| BENGALAS 60s sin humo 36u | **Bengalas** (¿o "Boom-boom"?) | 14,40 | 21% | KRITTIKALI | Bacanal |
| ALH RESERVA 0,30 RET | **Alhambra** | 20,41 (efectivo) | 21% | MAHOU | Bacanal |
| TOALLITA TISSUE 2 capas 3990u | **Toallita Tissue Especial** | 19,14 | 21% | KRITTIKALI | Habana |
| LAVAVAJILLAS **MANUAL** 5L | ¿**Fairy** o crear "manual"? | 5,49 | 21% | KRITTIKALI | Bacanal |
| ENTRECOT DE VACA (€/kg) | ¿**Lomo bajo frisona (350gr)** o crear "Entrecot"? | 28,90/kg | 10% | ENCINAR | Bacanal |
| FREGONA tejido sin tejer | ¿**Fregona Microfriba** o crear? | 1,03 | 21% | KRITTIKALI | Habana |

**Ojo formatos/unidad**: en Leche/Pan/Fuenteliviana el precio del albarán es por **caja/pack**, no por unidad
suelta — dime cómo lo quieres guardar (por ud o por formato de compra).

### B) Producto OK, pero el PROVEEDOR no está en catálogo (SERPESKA)
Casan perfecto con productos existentes; el proveedor "SERPESKA" no está en `proveedores` de Bacanal.
Tu nota antigua avisaba de lío de CIF (Serpeska / Distribuciones Mozos / Juanito Baker).
| Línea albarán | Producto catálogo | Precio | IVA |
|---|---|---|---|
| BURGER POTATO HIGH 75gr | Pan de Hamburguesa (High Potato) | 0,65 | 4% |
| ARTESANITO SEMILLADO 60gr | Artesanillo semillado (60 g) | 0,29 | 4% |
| ARTESANITO 55gr | Artesanillo (55 g) | 0,18 | 4% |
→ **¿Creamos el proveedor SERPESKA, o es Mozos / Juanito Baker?** Con eso los cargo.

### C) Producto NO existe en catálogo → ¿crear ficha de compra? (son de tus albaranes, precio real)
**Bacanal (Makro salvo indicado):**
| Producto (del albarán) | Precio | IVA |
|---|---|---|
| Mozzarella rallada pizza 2kg | 13,55 | 10% |
| Filete pechuga de pollo | 7,05/kg | 10% |
| Secreto de cerdo | 5,41/kg | 10% |
| Lomo de merluza gallega | 15,54/kg | 10% |
| Nata para montar 35% 1,5L | 5,86 | 10% |
| Huevo de codorniz (18u) | 1,96 | 4% |
| Yema de huevo 1L | 11,18 | 10% |
| Helado de vainilla 2,5L | 6,18 | 10% |
| Gyozas pollo y vegetales 600g | 5,84 | 10% |
| Gyozas vegetales 600g | 5,84 | 10% |
| Corvina 4-5kg | 10,89/kg | 10% |
| Chile rojo 100g | 2,17 | 4% |
| Citronela 300g | 4,46 | 10% |
| Orejones amarillos 1kg | 17,37 | 4% |
| Tomate deshidratado en aceite 960g | 10,33 | 10% |
| Aceite girasol alto oleico 25L | 51,50 | 10% |
| Puntalette (pasta) 500g | 2,15 | 10% |
| Papel de arroz 300g | 2,41 | 10% |
| Salsa tartufata clásica 500g | 14,10 | 10% |
| Zumo concentrado de limón 2L | 6,05 | 10% |
| Bayeta microfibra 4u (KRITTIKALI) | 2,95 | 21% |
| Base de arroz de **PAELLA** (hay carne/pescado/negro, no paella) (GARCIMAR) | 87,00/caja | 10% |
| **Paleta** cebo ibérico 50% lonch. 500g ("La Barrica"; ≠ jamón) | 31,65 | 10% |
| Fregona tejido sin tejer (KRITTIKALI) | 1,03 | 21% |

**Habana (Krittikali, menaje):**
| Producto | Precio | IVA |
|---|---|---|
| Tiki porta-vasos Cobra | 20,90 | 21% |
| Bowl 8×8×4 Ming | 1,08 | 21% |
| Biberón/dosificador 1L Araven | 1,90 | 21% |
| Lavafrutas apilable 12cm | 1,20 | 21% |

### Excluido — hoja de shisha/cachimba (Habana)
Una de las fotos NO es un albarán de proveedor: es un **Excel interno** ("ALBARAN HABANA 18-06-26"),
sin nº de documento ni IVA por línea, y con **riesgo de desalineación fila↔producto** por el ángulo.
No se cargó nada de ahí; necesita revisión manual contra tu Excel original.

---

## Cómo cargar lo que decidas
Dime por cada bloque: **(A)** cuáles son el mismo producto (y por ud o por formato); **(B)** el proveedor real
de los panes; **(C)** cuáles creamos. Lo cargo con el mismo método idempotente (o lo metes tú por la UI:
producto → pestaña de precios de compra). Los datos línea-a-línea completos están en las fotos de Fernando.

Relacionado: `docs/TAREA_FERNANDO_precios_compra_bacanal.md` (tu tarea original), `docs/LOGISTICA_COMPRAS_ESTADO_Y_PLAN.md`.
