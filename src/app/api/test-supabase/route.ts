import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()

    // Test basic connection by querying Supabase auth settings
    const { data, error } = await supabase.auth.getSession()

    if (error) {
      return NextResponse.json({ status: 'error', message: error.message }, { status: 500 })
    }

    return NextResponse.json({
      status: 'ok',
      message: 'Conexion con Supabase exitosa',
      session: data.session ? 'Sesion activa' : 'Sin sesion (normal si no hay login)',
    })
  } catch (err) {
    return NextResponse.json(
      { status: 'error', message: err instanceof Error ? err.message : 'Error desconocido' },
      { status: 500 }
    )
  }
}
