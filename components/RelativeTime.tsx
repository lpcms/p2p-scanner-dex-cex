"use client";

import { useEffect, useState } from "react";
import { formatRelativeTime } from "@/lib/format";

interface Props {
  ts: number;
  /** Текст пока не смонтировались (избегаем hydration mismatch) */
  fallback?: string;
}

/**
 * Показывает относительное время ("5s ago", "2m ago").
 * При первом рендере (SSR) выводит fallback, чтобы избежать hydration mismatch.
 * После монтирования обновляется каждую секунду.
 */
export default function RelativeTime({ ts, fallback = "—" }: Props) {
  const [mounted, setMounted] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    setMounted(true);
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  if (!mounted || ts === 0) return <>{fallback}</>;
  return <>{formatRelativeTime(ts)}</>;
}
