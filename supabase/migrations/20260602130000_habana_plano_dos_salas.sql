-- Snapshot del plano de COCTELERÍA HABANA tras ajustes en UI (2026-06-02).
--
-- Idempotente: si el local ya tiene mesas, no hace nada (prod queda intacto).
-- En entornos limpios siembra salas + zonas + mesas + decoraciones + plano.
--
-- Estructura:
--   Sala "Sala" (principal): Cuadrados, VIP, Altas, Barra, Redondas
--   Sala "Terrazas":         Terraza Interior, Terraza Exterior

DO $$
DECLARE
  v_local       uuid := '9d1ab861-475f-4008-ba8e-4ef0928b4ac6'; -- Coctelería Habana
  v_sala        uuid;
  v_terr        uuid;
  v_plano       uuid;
  z_cuadrados   uuid;
  z_vip         uuid;
  z_altas       uuid;
  z_barra       uuid;
  z_redondas    uuid;
  z_ti          uuid;
  z_te          uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM mesas WHERE local_id = v_local) THEN
    RAISE NOTICE 'HABANA ya tiene mesas; snapshot omitido.';
    RETURN;
  END IF;

  -- Salas
  INSERT INTO salas (local_id, nombre, orden, es_principal)
  VALUES (v_local, 'Sala', 1, true) RETURNING id INTO v_sala;

  INSERT INTO salas (local_id, nombre, orden, es_principal)
  VALUES (v_local, 'Terrazas', 2, false) RETURNING id INTO v_terr;

  -- Zonas - Sala
  INSERT INTO zonas (local_id, sala_id, nombre, color_pastel, orden, etiqueta_x, etiqueta_y)
  VALUES (v_local, v_sala, 'Cuadrados', '#FDE68A', 1, 480, 87) RETURNING id INTO z_cuadrados;
  INSERT INTO zonas (local_id, sala_id, nombre, color_pastel, orden, etiqueta_x, etiqueta_y)
  VALUES (v_local, v_sala, 'VIP',       '#DDD6FE', 2, 390, 391) RETURNING id INTO z_vip;
  INSERT INTO zonas (local_id, sala_id, nombre, color_pastel, orden, etiqueta_x, etiqueta_y)
  VALUES (v_local, v_sala, 'Altas',     '#FECACA', 3, 128, 389) RETURNING id INTO z_altas;
  INSERT INTO zonas (local_id, sala_id, nombre, color_pastel, orden, etiqueta_x, etiqueta_y)
  VALUES (v_local, v_sala, 'Barra',     '#FBCFE8', 4, 222, 153) RETURNING id INTO z_barra;
  INSERT INTO zonas (local_id, sala_id, nombre, color_pastel, orden, etiqueta_x, etiqueta_y)
  VALUES (v_local, v_sala, 'Redondas',  '#FED7AA', 5,  61, 230) RETURNING id INTO z_redondas;

  -- Zonas - Terrazas
  INSERT INTO zonas (local_id, sala_id, nombre, color_pastel, orden, etiqueta_x, etiqueta_y)
  VALUES (v_local, v_terr, 'Terraza Interior', '#A7F3D0', 1, 466, 76) RETURNING id INTO z_ti;
  INSERT INTO zonas (local_id, sala_id, nombre, color_pastel, orden, etiqueta_x, etiqueta_y)
  VALUES (v_local, v_terr, 'Terraza Exterior', '#BFDBFE', 2, 129, 79) RETURNING id INTO z_te;

  -- Mesas Cuadrados (C1..C6)
  INSERT INTO mesas (local_id, zona_id, codigo, capacidad_min, capacidad_max, tipo, forma, x, y) VALUES
    (v_local, z_cuadrados, 'C1', 4, 4, 'BAJA', 'cuadrada', 204.78,  20.94),
    (v_local, z_cuadrados, 'C2', 3, 3, 'BAJA', 'cuadrada', 291.11,  21.06),
    (v_local, z_cuadrados, 'C3', 3, 3, 'BAJA', 'cuadrada', 442.25,  20.50),
    (v_local, z_cuadrados, 'C4', 3, 3, 'BAJA', 'cuadrada', 512.63,  19.66),
    (v_local, z_cuadrados, 'C5', 3, 3, 'BAJA', 'cuadrada', 669.59,  19.61),
    (v_local, z_cuadrados, 'C6', 4, 4, 'BAJA', 'cuadrada', 742.20,  22.18);

  -- Mesas VIP (rectangulares con dimensiones)
  INSERT INTO mesas (local_id, zona_id, codigo, capacidad_min, capacidad_max, tipo, forma, x, y, width, height) VALUES
    (v_local, z_vip, 'VIP1', 8, 8, 'BAJA', 'rectangular', 336.40, 422.11, 160.00, 60.00),
    (v_local, z_vip, 'VIP2', 2, 2, 'BAJA', 'rectangular',  34.76, 155.66, 128.53, 43.95);

  -- Mesas Altas (A1..A6)
  INSERT INTO mesas (local_id, zona_id, codigo, capacidad_min, capacidad_max, tipo, forma, x, y) VALUES
    (v_local, z_altas, 'A1', 10, 15, 'ALTA', 'cuadrada', 727.73, 417.65),
    (v_local, z_altas, 'A2', 10, 15, 'ALTA', 'cuadrada', 625.01, 421.75),
    (v_local, z_altas, 'A3', 10, 15, 'ALTA', 'cuadrada', 524.82, 420.74),
    (v_local, z_altas, 'A4',  5,  5, 'ALTA', 'cuadrada', 233.90, 418.88),
    (v_local, z_altas, 'A5',  4,  4, 'ALTA', 'cuadrada', 125.54, 418.70),
    (v_local, z_altas, 'A6',  6,  6, 'ALTA', 'cuadrada',  20.00, 420.00);

  -- Mesas Barra (B1..B4)
  INSERT INTO mesas (local_id, zona_id, codigo, capacidad_min, capacidad_max, tipo, forma, x, y) VALUES
    (v_local, z_barra, 'B1', 2, 2, 'BARRA', 'cuadrada', 220.47, 260.34),
    (v_local, z_barra, 'B2', 2, 2, 'BARRA', 'cuadrada', 220.88, 178.53),
    (v_local, z_barra, 'B3', 2, 2, 'BARRA', 'cuadrada', 570.36, 257.88),
    (v_local, z_barra, 'B4', 2, 2, 'BARRA', 'cuadrada', 565.72, 181.10);

  -- Mesas Redondas (R1..R5)
  INSERT INTO mesas (local_id, zona_id, codigo, capacidad_min, capacidad_max, tipo, forma, x, y) VALUES
    (v_local, z_redondas, 'R1', 4, 4, 'BAJA', 'redonda',  33.02, 255.70),
    (v_local, z_redondas, 'R2', 4, 4, 'BAJA', 'redonda', 111.80, 255.82),
    (v_local, z_redondas, 'R3', 4, 4, 'BAJA', 'redonda', 694.64, 261.38),
    (v_local, z_redondas, 'R4', 4, 4, 'BAJA', 'redonda', 693.71, 174.17),
    (v_local, z_redondas, 'R5', 4, 4, 'BAJA', 'redonda', 797.54, 170.79);

  -- Mesas Terraza Interior (TI1..TI8)
  INSERT INTO mesas (local_id, zona_id, codigo, capacidad_min, capacidad_max, tipo, forma, x, y) VALUES
    (v_local, z_ti, 'TI1', 3, 3, 'BAJA', 'cuadrada', 461.62, 114.29),
    (v_local, z_ti, 'TI2', 4, 4, 'BAJA', 'cuadrada', 541.27, 115.55),
    (v_local, z_ti, 'TI3', 3, 3, 'BAJA', 'cuadrada', 460.25, 184.11),
    (v_local, z_ti, 'TI4', 3, 3, 'BAJA', 'cuadrada', 541.46, 184.12),
    (v_local, z_ti, 'TI5', 3, 3, 'BAJA', 'cuadrada', 460.07, 254.55),
    (v_local, z_ti, 'TI6', 3, 3, 'BAJA', 'cuadrada', 540.54, 252.22),
    (v_local, z_ti, 'TI7', 3, 3, 'BAJA', 'cuadrada', 456.79, 396.08),
    (v_local, z_ti, 'TI8', 4, 4, 'BAJA', 'cuadrada', 541.51, 391.49);

  -- Mesas Terraza Exterior (TE1..TE20)
  INSERT INTO mesas (local_id, zona_id, codigo, capacidad_min, capacidad_max, tipo, forma, x, y) VALUES
    (v_local, z_te, 'TE1',  5, 5, 'BAJA', 'cuadrada', 341.14, 124.75),
    (v_local, z_te, 'TE2',  4, 4, 'BAJA', 'cuadrada', 339.87, 234.79),
    (v_local, z_te, 'TE3',  4, 4, 'BAJA', 'cuadrada', 340.00, 320.00),
    (v_local, z_te, 'TE4',  5, 5, 'BAJA', 'cuadrada', 340.00, 400.00),
    (v_local, z_te, 'TE5',  4, 4, 'BAJA', 'cuadrada', 262.31, 124.29),
    (v_local, z_te, 'TE6',  4, 4, 'BAJA', 'cuadrada', 261.79, 232.89),
    (v_local, z_te, 'TE7',  4, 4, 'BAJA', 'cuadrada', 260.00, 320.00),
    (v_local, z_te, 'TE8',  4, 4, 'BAJA', 'cuadrada', 260.00, 400.00),
    (v_local, z_te, 'TE9',  4, 4, 'BAJA', 'cuadrada', 182.02, 124.26),
    (v_local, z_te, 'TE10', 4, 4, 'BAJA', 'cuadrada', 182.12, 234.01),
    (v_local, z_te, 'TE11', 4, 4, 'BAJA', 'cuadrada', 180.00, 320.00),
    (v_local, z_te, 'TE12', 4, 4, 'BAJA', 'cuadrada', 180.00, 400.00),
    (v_local, z_te, 'TE13', 2, 2, 'BAJA', 'cuadrada',  99.98, 121.43),
    (v_local, z_te, 'TE14', 2, 2, 'BAJA', 'cuadrada',  99.83, 234.44),
    (v_local, z_te, 'TE15', 4, 4, 'BAJA', 'cuadrada', 100.00, 320.00),
    (v_local, z_te, 'TE16', 4, 4, 'BAJA', 'cuadrada', 100.00, 400.00),
    (v_local, z_te, 'TE17', 2, 2, 'BAJA', 'cuadrada',  21.10, 123.00),
    (v_local, z_te, 'TE18', 2, 2, 'BAJA', 'cuadrada',  20.11, 232.17),
    (v_local, z_te, 'TE19', 3, 3, 'BAJA', 'cuadrada',  20.00, 320.00),
    (v_local, z_te, 'TE20', 4, 4, 'BAJA', 'cuadrada',  20.00, 400.00);

  -- Decoraciones - Sala
  INSERT INTO sala_decoraciones (sala_id, tipo, x, y, rotation, width, height) VALUES
    (v_sala, 'barra',   286.96, 173.59, 0, 272.19, 145.84),
    (v_sala, 'pasillo',  19.61, 350.30, 0, 751.80,  31.75),
    (v_sala, 'pasillo', 203.36, 115.41, 0, 547.18,  30.06),
    (v_sala, 'wc',      887.97, 224.11, 0,  90.71,  94.27);

  -- Decoraciones - Terrazas
  INSERT INTO sala_decoraciones (sala_id, tipo, x, y, rotation, width, height) VALUES
    (v_terr, 'pasillo', 464.47, 327.79, 0, 138.27,  46.67);

  -- Plano principal: reutilizar el existente o crear uno nuevo
  SELECT id INTO v_plano FROM planos WHERE local_id = v_local AND es_principal LIMIT 1;
  IF v_plano IS NULL THEN
    INSERT INTO planos (local_id, nombre, es_principal)
    VALUES (v_local, 'Cocteleria Habana', true)
    RETURNING id INTO v_plano;
  END IF;

  INSERT INTO plano_salas (plano_id, sala_id) VALUES (v_plano, v_sala) ON CONFLICT DO NOTHING;
  INSERT INTO plano_salas (plano_id, sala_id) VALUES (v_plano, v_terr) ON CONFLICT DO NOTHING;
END $$;
