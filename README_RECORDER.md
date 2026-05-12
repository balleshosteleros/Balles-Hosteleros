# 🎥 ReelForge Recorder - Guía de Instalación y Uso

¡Felicidades! Has integrado el sistema de grabación profesional **ReelForge Recorder**. Esta funcionalidad permite grabar pantalla, ventana o pestañas con almacenamiento automático en la nube (**Cloudflare R2**) y sincronización en base de datos (**Supabase**).

## 🚀 Lo que incluye esta rama (`feature/reelforge-recorder-r2`)
- **Grabador Profesional**: Con marco rojo animado y branding "REC".
- **Almacenamiento en R2**: Subida directa a Cloudflare para máxima velocidad y ahorro de espacio.
- **Biblioteca de Medios**: Nueva sección en `/mi-panel/grabaciones` para gestionar tus videos.
- **Sincronización Supabase**: Metadatos guardados automáticamente para persistencia.

---

## 🛠️ Pasos para activar (Setup)

El código ya está listo, pero para que funcione en tu entorno debes configurar las "llaves" (credenciales):

### 1. Configurar Variables de Entorno (`.env.local`)
Añade estas líneas a tu archivo `.env.local` con tus credenciales de Cloudflare y Supabase:

```env
# Cloudflare R2
R2_ENDPOINT="TU_ENDPOINT_DE_R2"
R2_ACCESS_KEY_ID="TU_ACCESS_KEY"
R2_SECRET_ACCESS_KEY="TU_SECRET_KEY"
R2_BUCKET_NAME="reelforge-recordings"
R2_PUBLIC_URL="TU_URL_PUBLICA_R2" # Ejemplo: https://pub-xxx.r2.dev

# Supabase (Asegúrate de que sean las correctas)
NEXT_PUBLIC_SUPABASE_URL="https://xxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJ..."
```

### 2. Crear la Tabla en Supabase
Ejecuta este SQL en tu panel de Supabase (SQL Editor) para que el sistema pueda guardar los registros:

```sql
CREATE TABLE IF NOT EXISTS public.recordings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    duration INTEGER DEFAULT 0,
    file_size INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Políticas de Seguridad (RLS)
ALTER TABLE public.recordings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read Access" ON public.recordings FOR SELECT USING (true);
CREATE POLICY "Public Insert Access" ON public.recordings FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Delete Access" ON public.recordings FOR DELETE USING (true);
```

### 3. Activar Acceso Público en R2
Recuerda entrar en Cloudflare R2 -> Tu Bucket -> Settings -> **Public Access** y habilitar el **"R2.dev subdomain"** para que los videos se puedan ver en la biblioteca.

---

## 📝 Próximos Pasos (Fase 2)
- [ ] **Google Drive Integration**: Preparando el terreno para el respaldo adicional.
- [ ] **Generación de Thumbnails**: Miniaturas automáticas para la biblioteca.

---
*Hecho con ❤️ por el equipo de Desarrollo.*
