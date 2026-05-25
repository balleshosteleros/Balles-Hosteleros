"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function useTabQuery<T extends string>(
  values: readonly T[],
  fallback: T,
  paramKey: string = "vista",
): [T, (next: T) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const value = useMemo<T>(() => {
    const v = searchParams?.get(paramKey);
    return (values as readonly string[]).includes(v ?? "") ? (v as T) : fallback;
  }, [searchParams, values, fallback, paramKey]);

  const setValue = useCallback(
    (next: T) => {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      if (next === fallback) params.delete(paramKey);
      else params.set(paramKey, next);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    },
    [router, pathname, searchParams, fallback, paramKey],
  );

  return [value, setValue];
}
