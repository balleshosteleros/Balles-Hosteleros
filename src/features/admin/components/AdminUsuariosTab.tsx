'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Trash2, UserPlus } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { createEmployee, getEmployees, deleteEmployee } from '@/actions/admin'
import type { Profile } from '@/types/database'

const ROLES = ['empleado', 'cocinero', 'camarero', 'gerente', 'admin']

const rolBadge: Record<string, string> = {
  admin: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  gerente: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  cocinero: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  camarero: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  empleado: 'bg-gray-100 text-gray-800 dark:bg-gray-900/40 dark:text-gray-300',
}

export function AdminUsuariosTab() {
  const [employees, setEmployees] = useState<(Profile & { role?: string })[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [formLoading, setFormLoading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  async function loadEmployees() {
    setLoading(true)
    const result = await getEmployees()
    setEmployees((result.data ?? []) as (Profile & { role?: string })[])
    setLoading(false)
  }

  useEffect(() => {
    loadEmployees()
  }, [])

  async function handleCreate(formData: FormData) {
    setFormLoading(true)
    setFormError(null)

    const result = await createEmployee(formData)

    if (result?.error) {
      setFormError(result.error)
    } else {
      setShowForm(false)
      loadEmployees()
    }
    setFormLoading(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Seguro que quieres eliminar este usuario?')) return
    setDeleting(id)
    const result = await deleteEmployee(id)
    if (result?.error) {
      alert(result.error)
    } else {
      setEmployees(employees.filter((e) => e.id !== id))
    }
    setDeleting(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Usuarios del sistema</h2>
          <p className="text-sm text-muted-foreground">Crea y gestiona los accesos de tus empleados</p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setShowForm(true)}>
          <UserPlus className="h-4 w-4" /> Nuevo usuario
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Cargando usuarios...</div>
          ) : employees.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No hay usuarios registrados</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Fecha alta</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((emp) => (
                  <TableRow key={emp.id}>
                    <TableCell className="font-medium text-sm">{emp.full_name || '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{emp.email}</TableCell>
                    <TableCell>
                      <Badge className={`${rolBadge[emp.role || 'empleado'] || rolBadge.empleado} text-[10px]`}>
                        {(emp.role || 'empleado').charAt(0).toUpperCase() + (emp.role || 'empleado').slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(emp.created_at).toLocaleDateString('es-ES')}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(emp.id)}
                        disabled={deleting === emp.id}
                        className="text-red-600 hover:text-red-800 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" /> Nuevo usuario
            </DialogTitle>
          </DialogHeader>
          <form action={handleCreate} className="space-y-4">
            <div>
              <label htmlFor="full_name" className="block text-sm font-medium mb-1">Nombre completo</label>
              <Input id="full_name" name="full_name" required />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1">Email</label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-1">Contraseña</label>
              <Input id="password" name="password" type="password" required minLength={6} />
            </div>
            <div>
              <label htmlFor="role" className="block text-sm font-medium mb-1">Rol</label>
              <Select name="role" defaultValue="empleado">
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona rol" />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formError && <p className="text-sm text-red-600">{formError}</p>}

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button type="submit" disabled={formLoading}>
                {formLoading ? 'Creando...' : 'Crear usuario'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
