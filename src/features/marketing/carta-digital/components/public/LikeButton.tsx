"use client";

import { useState, useTransition } from "react";
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
        // Revert
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
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={!deviceId || pending}
        aria-label={optimistic.liked ? "Quitar me gusta" : "Me gusta"}
        className={`flex items-center gap-2 rounded-full px-5 py-3 text-base font-semibold shadow-sm transition active:scale-95 disabled:opacity-60 ${
          optimistic.liked
            ? "bg-rose-500 text-white"
            : "bg-white text-stone-900 ring-1 ring-stone-200"
        }`}
      >
        <span className="text-2xl leading-none">{optimistic.liked ? "❤️" : "🤍"}</span>
        <span>{optimistic.count}</span>
      </button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
