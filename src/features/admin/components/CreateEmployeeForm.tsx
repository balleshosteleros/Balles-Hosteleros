'use client'

import { useState } from 'react'
import { createEmployee } from '@/actions/admin'

const ROLES = ['empleado', 'cocinero', 'camarero', 'gerente', 'admin']

export function CreateEmployeeForm({ onSuccess }: { onSuccess?: () => void }) {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    setSuccess(false)

    const result = await createEmployee(formData)

    if (result?.error) {
      setError(result.error)
    } else {
      setSuccess(true)
      onSuccess?.()
    }
    setLoading(false)
  }

  return (
    <form action={handleSubmit} className="space-y-4 rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="text-lg font-semibold">Nuevo empleado</h2>

      <div>
        <label htmlFor="full_name" className="block text-sm font-medium">
          Nombre completo
        </label>
        <input
          id="full_name"
          name="full_name"
          type="text"
          required
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium">
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={6}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div>
        <label htmlFor="role" className="block text-sm font-medium">
          Rol
        </label>
        <select
          id="role"
          name="role"
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {role.charAt(0).toUpperCase() + role.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-600">Empleado creado correctamente</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Creando...' : 'Crear empleado'}
      </button>
    </form>
  )
}
