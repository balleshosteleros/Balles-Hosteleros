"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AvatarPicker } from "@/features/auth/components/AvatarPicker";

export interface AvatarPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AvatarPickerDialog({ open, onOpenChange }: AvatarPickerDialogProps) {
  const [pickerKey, setPickerKey] = useState(0);

  function handleOpenChange(next: boolean) {
    if (next) setPickerKey((k) => k + 1);
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cambiar foto de perfil</DialogTitle>
          <DialogDescription>
            Hazte una foto con la cámara o sube una imagen desde tu dispositivo.
          </DialogDescription>
        </DialogHeader>
        <AvatarPicker
          key={pickerKey}
          variant="dialog"
          confirmLabel="Guardar foto"
        />
      </DialogContent>
    </Dialog>
  );
}
