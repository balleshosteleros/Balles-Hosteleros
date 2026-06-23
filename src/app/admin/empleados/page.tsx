import { redirect } from 'next/navigation'

// PRP-067: la creación manual de empleados se retiró. Este punto de arranque
// legacy ya no se usa; redirige a la gestión real de RRHH. El alta de empleados
// se hace por el portal de empleo (contratación) o el volcado masivo del onboarding.
export default function EmpleadosAdminPage() {
  redirect('/rrhh/empleados')
}
