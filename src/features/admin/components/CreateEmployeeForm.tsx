'use client'

import { useState, FormEvent } from 'react'
import { createEmployee } from '@/actions/admin'
import { useReglasSubmodulo } from '@/features/ajustes/hooks/use-reglas-submodulo'
import { ValidacionFaltantesDialog } from '@/features/ajustes/components/ValidacionFaltantesDialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LabelConRegla } from '@/components/forms/LabelConRegla'
import { BotonesGuardarBorrador } from '@/components/forms/BotonesGuardarBorrador'

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
  // Admin crea USUARIO con auth (email+password obligatorios para login),
  // no admite borrador aunque "empleados" como entidad sí sea migrable.
  const admiteBorrador = false

  const formValues = { full_name: fullName, email, password, role }
  const { labelsFaltantes } = validar(formValues)

  async function handleSubmit(e?: FormEvent<HTMLFormElement>) {
    e?.preventDefault()
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
      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-lg border bg-card p-6"
      >
        <h2 className="text-lg font-semibold">Nuevo empleado</h2>

        <div className="space-y-1.5">
          <LabelConRegla
            moduloKey="rrhh"
            submoduloKey="empleados"
            campoKey="full_name"
            htmlFor="full_name"
          >
            Nombre completo
          </LabelConRegla>
          <Input
            id="full_name"
            name="full_name"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <LabelConRegla
            moduloKey="rrhh"
            submoduloKey="empleados"
            campoKey="email"
            htmlFor="email"
          >
            Email
          </LabelConRegla>
          <Input
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <LabelConRegla
            moduloKey="rrhh"
            submoduloKey="empleados"
            campoKey="password"
            htmlFor="password"
          >
            Contraseña
          </LabelConRegla>
          <Input
            id="password"
            name="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
          />
        </div>

        <div className="space-y-1.5">
          <LabelConRegla
            moduloKey="rrhh"
            submoduloKey="empleados"
            campoKey="role"
            htmlFor="role"
          >
            Rol
          </LabelConRegla>
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger id="role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {success && (
          <p className="text-sm text-green-600">Empleado creado correctamente</p>
        )}

        <BotonesGuardarBorrador
          onGuardar={() => void handleSubmit()}
          faltantes={labelsFaltantes}
          loading={loading}
          labelGuardar="Crear empleado"
          admiteBorrador={admiteBorrador}
        />
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
