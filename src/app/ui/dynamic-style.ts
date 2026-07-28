import { DestroyRef, Signal, effect, inject } from '@angular/core';

/**
 * Keeps a `<style>` element in `document.head` in sync with a CSS signal, and
 * removes it when the owning component is destroyed. Replaces the React
 * `<style dangerouslySetInnerHTML>` blocks used for per-view print rules.
 *
 * Must be called from an injection context (field initialiser or constructor).
 */
export function useDynamicStyle(css: Signal<string>): void {
  const styleEl = document.createElement('style');
  document.head.appendChild(styleEl);

  effect(() => {
    styleEl.textContent = css();
  });

  inject(DestroyRef).onDestroy(() => styleEl.remove());
}
