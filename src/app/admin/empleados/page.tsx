import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getRolContext } from '@/features/auth/actions/permisos-actions'
import { AdminPanel } from '@/features/admin/components/AdminPanel'

export default async function EmpleadosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/')

  // Fuente única (PRP-063): el panel admin es solo para director.
  const { esDirector } = await getRolContext(user.id)
  if (!esDirector) redirect('/')

  return <AdminPanel />
}
