"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  /** Массив доступных сетей */
  available: string[];
  /** Массив выбранных сетей. Если пустой ИЛИ содержит "ALL" — считается "все" */
  selected: string[];
  /** Колбэк при изменении выбора */
  onChange: (selected: string[]) => void;
}

const ALL = "ALL";

/**
 * Dropdown с чекбоксами для multi-select сетей.
 *
 * Логика:
 * - selected = ["ALL"] (или []) → показываем все сети
 * - selected = ["ETH", "BSC"] → показываем только выбранные
 * - Клик по "All Networks":
 *     - если уже [ALL] — без эффекта
 *     - иначе очищаем выбор → [ALL]
 * - Клик по конкретной сети:
 *     - если была в выборе — убираем; если осталось 0 — [ALL]
 *     - если не было — добавляем (ALL автоматически снимается)
 */
export default function NetworkMultiSelect({
  available,
  selected,
  onChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Закрытие по клику вне
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  // Закрытие по Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const isAllSelected =
    selected.length === 0 || (selected.length === 1 && selected[0] === ALL);

  const toggleAll = () => {
    if (!isAllSelected) {
      onChange([ALL]);
    }
    // если уже all — ничего не делаем
  };

  const toggleNetwork = (net: string) => {
    let next: string[];
    if (isAllSelected) {
      // ALL → одна выбранная сеть
      next = [net];
    } else if (selected.includes(net)) {
      // Убираем сеть
      next = selected.filter((s) => s !== net);
      if (next.length === 0) next = [ALL];
    } else {
      // Добавляем сеть
      next = [...selected.filter((s) => s !== ALL), net];
    }
    onChange(next);
  };

  // Текст в кнопке
  let buttonLabel: string;
  if (isAllSelected) {
    buttonLabel = "All Networks";
  } else if (selected.length === 1) {
    buttonLabel = selected[0];
  } else {
    buttonLabel = `${selected.length} networks`;
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between min-w-[140px] px-3 py-1.5 rounded-md bg-bg border border-border text-sm font-semibold text-text-primary hover:border-border-strong transition-colors focus:outline-none focus:border-accent-green"
        title="Select networks"
      >
        <span className="truncate">{buttonLabel}</span>
        <span
          className={`ml-2 text-text-secondary transition-transform ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        >
          ▾
        </span>
      </button>

      {open && (
        <div className="absolute z-40 mt-1 w-56 rounded-md border border-border bg-bg-elevated shadow-lg max-h-80 overflow-y-auto">
          {/* All Networks */}
          <button
            type="button"
            onClick={toggleAll}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-bg-hover transition-colors border-b border-border"
          >
            <CheckboxBox checked={isAllSelected} />
            <span className="font-semibold text-text-primary">
              All Networks
            </span>
          </button>

          {available.map((net) => {
            const checked = !isAllSelected && selected.includes(net);
            return (
              <button
                key={net}
                type="button"
                onClick={() => toggleNetwork(net)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-bg-hover transition-colors"
              >
                <CheckboxBox checked={checked} />
                <span className="text-text-primary">{net}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CheckboxBox({ checked }: { checked: boolean }) {
  return (
    <span
      className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors ${
        checked
          ? "bg-accent-green border-accent-green"
          : "bg-bg border-border-strong"
      }`}
      aria-hidden="true"
    >
      {checked && (
        <span className="text-bg text-[11px] leading-none font-bold">✓</span>
      )}
    </span>
  );
}
