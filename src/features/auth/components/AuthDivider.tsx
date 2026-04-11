interface AuthDividerProps {
  label?: string
}

export function AuthDivider({ label = 'o' }: AuthDividerProps) {
  return (
    <div className="relative my-6">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-slate-800" />
      </div>
      <div className="relative flex justify-center text-xs uppercase tracking-wider">
        <span className="bg-slate-950 px-3 text-slate-500">{label}</span>
      </div>
    </div>
  )
}
