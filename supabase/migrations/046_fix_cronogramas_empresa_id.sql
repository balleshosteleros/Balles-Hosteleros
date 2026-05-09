-- 046_fix_cronogramas_empresa_id.sql
-- Añade la columna empresa_id a la tabla cronogramas_operativos para soporte multi-tenencia.

DO $$ 
BEGIN
    -- 1. Añadir la columna como nullable inicialmente
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'cronogramas_operativos' 
        AND column_name = 'empresa_id'
    ) THEN
        ALTER TABLE public.cronogramas_operativos 
        ADD COLUMN empresa_id UUID REFERENCES public.empresas(id);
    END IF;

    -- 2. Backfill: asignar registros existentes a la empresa por defecto si es necesario
    -- Usamos la empresa por defecto definida en la migración 002
    UPDATE public.cronogramas_operativos 
    SET empresa_id = '00000000-0000-0000-0000-000000000001' 
    WHERE empresa_id IS NULL;

    -- 3. Hacer la columna NOT NULL una vez poblada (opcional, pero recomendado para RLS)
    -- ALTER TABLE public.cronogramas_operativos ALTER COLUMN empresa_id SET NOT NULL;

END $$;

-- 4. Crear índice para mejorar rendimiento de filtros
CREATE INDEX IF NOT EXISTS idx_cronogramas_empresa_id ON public.cronogramas_operativos(empresa_id);

-- 5. Actualizar políticas de RLS
ALTER TABLE public.cronogramas_operativos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir select por empresa" ON public.cronogramas_operativos;
CREATE POLICY "Permitir select por empresa" 
    ON public.cronogramas_operativos FOR SELECT 
    USING (empresa_id IS NULL OR empresa_id IN (
        SELECT empresa_id FROM public.profiles WHERE user_id = auth.uid()
    ));

DROP POLICY IF EXISTS "Permitir insert por empresa" ON public.cronogramas_operativos;
CREATE POLICY "Permitir insert por empresa" 
    ON public.cronogramas_operativos FOR INSERT 
    WITH CHECK (empresa_id IN (
        SELECT empresa_id FROM public.profiles WHERE user_id = auth.uid()
    ));

DROP POLICY IF EXISTS "Permitir update por empresa" ON public.cronogramas_operativos;
CREATE POLICY "Permitir update por empresa" 
    ON public.cronogramas_operativos FOR UPDATE 
    USING (empresa_id IN (
        SELECT empresa_id FROM public.profiles WHERE user_id = auth.uid()
    ));

DROP POLICY IF EXISTS "Permitir delete por empresa" ON public.cronogramas_operativos;
CREATE POLICY "Permitir delete por empresa" 
    ON public.cronogramas_operativos FOR DELETE 
    USING (empresa_id IN (
        SELECT empresa_id FROM public.profiles WHERE user_id = auth.uid()
    ));
