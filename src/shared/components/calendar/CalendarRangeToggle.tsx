"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { CALENDAR_RANGE_MODES, type CalendarRangeMode } from "./calendar-range";

const LABELS_LARGOS: Record<CalendarRangeMode, string> = {
  DIARIO: "Diario",
  SEMANAL: "Semanal",
  MENSUAL: "Mensual",
  TRIMESTRAL: "Trimestral",
  SEMESTRAL: "Semestral",
  ANUAL: "Anual",
};

interface ToggleProps {
  mode: CalendarRangeMode;
  onChange: (m: CalendarRangeMode) => void;
  modes?: CalendarRangeMode[];
  className?: string;
}

export function CalendarRangeToggle({ mode, onChange, modes = CALENDAR_RANGE_MODES, className }: ToggleProps) {
  return (
    <Select value={mode} onValueChange={(v) => onChange(v as CalendarRangeMode)}>
      <SelectTrigger
        className={cn(
          "h-8 w-[120px] text-xs font-medium text-muted-foreground border-none bg-transparent shadow-none hover:bg-muted/40 focus:ring-0 focus:ring-offset-0",
          className,
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="start">
        {modes.map((m) => (
          <SelectItem key={m} value={m} className="text-xs">
            {LABELS_LARGOS[m]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

interface NavProps {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  onToday?: () => void;
  isToday?: boolean;
  className?: string;
  minWidth?: number;
}

export function CalendarRangeNav({ label, onPrev, onNext, onToday, isToday, className, minWidth = 220 }: NavProps) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onPrev}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <div className="text-sm font-medium text-center capitalize" style={{ minWidth }}>
        {label}
      </div>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onNext}>
        <ChevronRight className="h-4 w-4" />
      </Button>
      {onToday && !isToday && (
        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={onToday}>
          Hoy
        </Button>
      )}
    </div>
  );
}
