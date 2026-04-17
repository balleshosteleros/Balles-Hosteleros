import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import type { CartaItem } from "../../types";

export function MetricasLikesPanel({ items }: { items: CartaItem[] }) {
  const top = [...items].sort((a, b) => b.likes_count - a.likes_count).slice(0, 10);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Top 10 más votados</CardTitle>
      </CardHeader>
      <CardContent>
        {top.length === 0 ? (
          <p className="text-sm text-stone-500">Aún no hay votos.</p>
        ) : (
          <ol className="space-y-2">
            {top.map((it, i) => (
              <li
                key={it.id}
                className="flex items-center justify-between rounded-md bg-stone-50 px-3 py-2"
              >
                <span className="flex items-baseline gap-2 truncate">
                  <span className="font-bold text-stone-400">#{i + 1}</span>
                  <span className="truncate font-medium">{it.nombre}</span>
                </span>
                <span className="font-semibold text-rose-600">❤ {it.likes_count}</span>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
