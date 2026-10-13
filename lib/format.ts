export function formatUsd(value: number, opts: { compact?: boolean } = {}): string {
  if (!isFinite(value)) return "—";
  if (opts.compact) {
    if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
    if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(2)}K`;
  }
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatPrice(value: number): string {
  if (!isFinite(value) || value === 0) return "—";
  if (value >= 1) {
    return `$${value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    })}`;
  }
  if (value >= 0.0001) {
    return `$${value.toFixed(6)}`;
  }
  // Очень маленькие числа — научная нотация с упрощением
  return `$${value.toPrecision(4)}`;
}

export function formatPercent(value: number, sign = true): string {
  if (!isFinite(value)) return "—";
  const s = sign && value > 0 ? "+" : "";
  return `${s}${value.toFixed(2)}%`;
}

export function formatProfit(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${formatUsd(value)}`;
}

export function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function formatRelativeTime(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}
