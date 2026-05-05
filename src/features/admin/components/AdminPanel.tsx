'use client'

import { useEffect, useState } from 'react'
import { getEmployees } from '@/actions/admin'
import { CreateEmployeeForm } from './CreateEmployeeForm'
import { EmployeeList } from './EmployeeList'
import type { Profile } from '@/types/database'
import { LoadingSpinner } from '@/shared/components/LoadingSpinner'

export function AdminPanel() {
  const [employees, setEmployees] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  async function loadEmployees() {
    setLoading(true)
    const result = await getEmployees()
    setEmployees(result.data as Profile[])
    setLoading(false)
  }

  useEffect(() => {
    loadEmployees()
  }, [])

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-8">
      <CreateEmployeeForm onSuccess={loadEmployees} />

      <div>
        <h2 className="mb-4 text-lg font-semibold">Empleados</h2>
        {loading ? (
          <LoadingSpinner />
        ) : (
          <EmployeeList employees={employees} />
        )}
      </div>
    </div>
  )
}
