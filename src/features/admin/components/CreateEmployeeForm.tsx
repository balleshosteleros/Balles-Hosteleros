'use client'

import { useState, FormEvent } from 'react'
import { createEmployee } from '@/actions/admin'
import { useReglasSubmodulo } from '@/features/ajustes/hooks/use-reglas-submodulo'
import { ValidacionFaltantesDialog } from '@/features/ajustes/components/ValidacionFaltantesDialog'

const ROLES = ['empleado', 'cocinero', 'camarero', 'gerente', 'admin']

export function CreateEmployeeForm({ onSuccess }: { onSuccess?: () => void }) {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState(ROLES[0])
  const [faltantes, setFaltantes] = useState<string[]>([])

  const { validar } = useReglasSubmodulo('rrhh', 'empleados')

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()

    const { labelsFaltantes } = validar({
      full_name: fullName,
      email,
      password,
      role,
    })
    if (labelsFaltantes.length > 0) {
      setFaltantes(labelsFaltantes)
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(false)

    const formData = new FormData()
    formData.set('full_name', fullName)
    formData.set('email', email)
    formData.set('password', password)
    formData.set('role', role)

    const result = await createEmployee(formData)

    if (result?.error) {
      setError(result.error)
    } else {
      setSuccess(true)
      setFullName('')
      setEmail('')
      setPassword('')
      setRole(ROLES[0])
      onSuccess?.()
    }
    setLoading(false)
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold">Nuevo empleado</h2>

        <div>
          <label htmlFor="full_name" className="block text-sm font-medium">
            Nombre completo
          </label>
          <input
            id="full_name"
            name="full_name"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
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
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r.charAt(0).toUpperCase() + r.slice(1)}
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

      <ValidacionFaltantesDialog
        open={faltantes.length > 0}
        onClose={() => setFaltantes([])}
        campos={faltantes}
        submoduloLabel="Empleados"
      />
    </>
  )
}
