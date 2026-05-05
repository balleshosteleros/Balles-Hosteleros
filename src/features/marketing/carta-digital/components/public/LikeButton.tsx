"use client";

import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { toggleLike } from "../../actions/like-actions";

export function LikeButton({
  itemId,
  deviceId,
  liked,
  likesCount,
  onToggleLocal,
}: {
  itemId: string;
  deviceId: string | null;
  liked: boolean;
  likesCount: number;
  onToggleLocal: (itemId: string, liked: boolean) => void;
}) {
  const [optimistic, setOptimistic] = useState({ liked, count: likesCount });
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleClick = () => {
    if (!deviceId || pending) return;
    const willLike = !optimistic.liked;
    const nextCount = optimistic.count + (willLike ? 1 : -1);
    setOptimistic({ liked: willLike, count: Math.max(0, nextCount) });
    onToggleLocal(itemId, willLike);
    setError(null);

    startTransition(async () => {
      const res = await toggleLike(itemId, deviceId);
      if (!res.ok) {
        setOptimistic({ liked: !willLike, count: optimistic.count });
        onToggleLocal(itemId, !willLike);
        setError(res.error);
        return;
      }
      setOptimistic({ liked: res.liked, count: res.likesCount });
      onToggleLocal(itemId, res.liked);
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={!deviceId || pending}
        aria-label={optimistic.liked ? "Quitar me gusta" : "Me gusta"}
        className="group inline-flex items-center gap-1.5 rounded-full border px-3 py-2 transition active:scale-90 disabled:opacity-60"
        style={{
          borderColor: optimistic.liked ? "var(--carta-primario)" : "var(--carta-borde)",
          color: optimistic.liked ? "var(--carta-primario)" : "var(--carta-texto-tenue)",
          backgroundColor: optimistic.liked
            ? "color-mix(in srgb, var(--carta-primario) 8%, transparent)"
            : "transparent",
        }}
      >
        <Heart
          className={`h-5 w-5 transition ${optimistic.liked ? "fill-current" : ""}`}
          strokeWidth={1.5}
        />
        {optimistic.count > 0 ? (
          <span className="text-[12px] font-medium tabular-nums">{optimistic.count}</span>
        ) : null}
      </button>
      {error ? <span className="text-[10px] text-red-500">{error}</span> : null}
    </div>
  );
}
