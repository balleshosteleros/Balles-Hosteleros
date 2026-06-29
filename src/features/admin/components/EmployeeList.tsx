'use client'

import { useState } from 'react'
import { deleteEmployee } from '@/actions/admin'
import type { Profile } from '@/types/database'
import { useConfirmDelete } from '@/shared/components/ConfirmDeleteDialog'
import { formatFechaEnZona } from '@/features/empresa/lib/zona-horaria'

export function EmployeeList({ employees: initial }: { employees: Profile[] }) {
  const [employees, setEmployees] = useState(initial)
  const [deleting, setDeleting] = useState<string | null>(null)
  const { confirm: confirmDelete, dialog: confirmDeleteDialog } = useConfirmDelete()

  async function handleDelete(id: string) {
    const ok = await confirmDelete({
      title: '¿Eliminar empleado?',
      description: 'Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar',
    })
    if (!ok) return

    setDeleting(id)
    const result = await deleteEmployee(id)

    if (result?.error) {
      alert(result.error)
    } else {
      setEmployees(employees.filter((e) => e.id !== id))
    }
    setDeleting(null)
  }

  if (employees.length === 0) {
    return <p className="text-gray-500">No hay empleados registrados.</p>
  }

  return (
    <>
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Nombre</th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Email</th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Rol</th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Creado</th>
            <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {employees.map((emp) => (
            <tr key={emp.id}>
              <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                {emp.full_name || '-'}
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">{emp.email}</td>
              <td className="whitespace-nowrap px-6 py-4 text-sm">
                <span className="inline-flex rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800">
                  {(emp as Profile & { role?: string }).role || 'empleado'}
                </span>
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                {/* Admin global (sin empresa activa): zona "Europe/Madrid" explícita. */}
                {formatFechaEnZona(emp.created_at, 'Europe/Madrid')}
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                <button
                  onClick={() => handleDelete(emp.id)}
                  disabled={deleting === emp.id}
                  className="text-red-600 hover:text-red-800 disabled:opacity-50"
                >
                  {deleting === emp.id ? 'Eliminando...' : 'Eliminar'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    {confirmDeleteDialog}
    </>
  )
}
