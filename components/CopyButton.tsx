"use client";

import { useState, useRef, useEffect } from "react";

interface Props {
  /** Что копировать */
  text: string;
  /** Подсказка при наведении */
  title: string;
  /** Цвет иконки (Tailwind класс), также используется для hover-цвета */
  colorClass?: string;
}

/**
 * Маленькая кнопка-иконка для копирования произвольного текста
 * в буфер обмена. После клика на 1.5 сек показывает галочку.
 */
export default function CopyButton({
  text,
  title,
  colorClass = "text-text-primary hover:text-accent-blue",
}: Props) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const onClick = async (e: React.MouseEvent) => {
    e.stopPropagation(); // не выделять строку при клике
    e.preventDefault();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback для старых браузеров / http (без https)
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      title={copied ? "Copied!" : title}
      className={`inline-flex items-center justify-center w-[18px] h-[18px] leading-none transition-colors ${
        copied ? "text-accent-green" : colorClass
      }`}
      aria-label={title}
    >
      <span className="text-[14px]">{copied ? "✓" : "⧉"}</span>
    </button>
  );
}
