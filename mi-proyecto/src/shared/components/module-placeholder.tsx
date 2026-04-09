import { type LucideIcon } from "lucide-react";

interface Props {
  title: string;
  icon: LucideIcon;
  description: string;
}

export default function ModulePlaceholder({ title, icon: Icon, description }: Props) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-12">
      <div className="rounded-2xl bg-card border p-12 text-center max-w-md">
        <Icon className="h-16 w-16 mx-auto mb-4 text-primary/40" />
        <h2 className="text-2xl font-bold text-foreground mb-2">{title}</h2>
        <p className="text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
