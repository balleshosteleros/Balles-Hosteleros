import React from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Trash2 } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "info";
  isLoading?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  variant = "danger",
  isLoading = false
}: ConfirmModalProps) {
  
  const getIcon = () => {
    switch (variant) {
      case "danger": return <Trash2 className="w-6 h-6 text-red-500" />;
      default: return <AlertTriangle className="w-6 h-6 text-amber-500" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] bg-white/80 backdrop-blur-xl border-white/20 shadow-2xl">
        <DialogHeader className="flex flex-col items-center gap-4 text-center">
          <div className={`p-3 rounded-full ${variant === 'danger' ? 'bg-red-50' : 'bg-amber-50'}`}>
            {getIcon()}
          </div>
          <DialogTitle className="text-xl font-bold text-slate-800">{title}</DialogTitle>
          <DialogDescription className="text-slate-500 leading-relaxed">
            {description}
          </DialogDescription>
        </DialogHeader>
        
        <DialogFooter className="flex flex-row gap-3 sm:justify-center mt-6">
          <Button 
            variant="outline" 
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 border-slate-200 hover:bg-slate-50 transition-all"
          >
            {cancelText}
          </Button>
          <Button 
            variant={variant === 'danger' ? 'destructive' : 'default'}
            onClick={onConfirm}
            disabled={isLoading}
            className={`flex-1 transition-all shadow-lg ${variant === 'danger' ? 'shadow-red-200' : 'shadow-blue-200'}`}
          >
            {isLoading ? "Procesando..." : confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
