-- Migración: 002_cronogramas_operativos.sql
-- Descripción: Tabla maestra para los cronogramas operativos (frecuencias)

-- Habilitar la extensión UUID si no está activada en Supabase
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Crear la tabla principal
CREATE TABLE public.cronogramas_operativos (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    rol VARCHAR(255) NOT NULL,
    tarea TEXT NOT NULL,
    frecuencia VARCHAR(50) NOT NULL,
    formacion TEXT,
    tiempo_requerido VARCHAR(100),
    id_tarea_original VARCHAR(100), -- Para trazabilidad con el Excel (opcional)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indice para que las consultas por ROL sean muy veloces (ej. Cuando se filtre "Jefe de Sala")
CREATE INDEX idx_cronogramas_rol ON public.cronogramas_operativos(rol);

-- Activar RLS (Row Level Security)
ALTER TABLE public.cronogramas_operativos ENABLE ROW LEVEL SECURITY;

-- Por defecto crearemos políticas abiertas para testing (pueden restringirse luego según el user_id de Supabase Auth)
CREATE POLICY "Permitir select a todos los perfiles autenticados" 
    ON public.cronogramas_operativos FOR SELECT 
    USING (true); -- Ajustar en produccion para requerir auth.uid()

CREATE POLICY "Permitir insert/update a todos los perfiles con rol admin/direccion" 
    ON public.cronogramas_operativos FOR ALL 
    USING (true)
    WITH CHECK (true);

-- Trigger para automatizar el updated_at si fuera necesario
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

CREATE TRIGGER trg_cronogramas_actualizacion
BEFORE UPDATE ON public.cronogramas_operativos
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
