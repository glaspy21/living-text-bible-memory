"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/client/lib/cn";

/** How far above the bottom edge a row travels from invisible to fully shown. */
const REVEAL_ZONE = 190;
const RISE = 18;

/**
 * Rows fade in and rise 18px as they scroll up from the bottom edge of the page (scroll-linked,
 * not time-based; matches docs/reference/motion/gradual-reveal.mp4). Each direct child is a row.
 * With reduced motion every row is simply shown.
 */
export function RevealRows({ children, className }: { children: ReactNode; className?: string }) {
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = list.current;
    const scroller = element?.closest<HTMLElement>(".shell-main");
    if (!element || !scroller) return;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;

    const apply = () => {
      frame = 0;
      const bottom = scroller.getBoundingClientRect().bottom;
      for (const row of Array.from(element.children) as HTMLElement[]) {
        const t = calm.matches
          ? 1
          : Math.max(0, Math.min(1, (bottom - row.getBoundingClientRect().top - 6) / REVEAL_ZONE));
        row.style.opacity = t.toFixed(3);
        row.style.transform = `translateY(${((1 - t) * RISE).toFixed(1)}px)`;
      }
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(apply);
    };

    apply();
    scroller.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    const observer = new ResizeObserver(schedule); // rows added or the page resized
    observer.observe(element);
    observer.observe(scroller);
    return () => {
      cancelAnimationFrame(frame);
      scroller.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      observer.disconnect();
    };
  }, []);

  return (
    // Bottom room lets the last row scroll far enough up to reach full opacity.
    <div ref={list} className={cn("pb-[160px]", className)} data-testid="reveal-rows">
      {children}
    </div>
  );
}
