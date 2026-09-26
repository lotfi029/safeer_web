/**
 * Browser-side motion guard shared by the scroll-driven UI (reveal, counter). Call it only inside
 * `afterNextRender` (never on the server): it returns false when there is no window, no
 * IntersectionObserver, or the visitor asked for reduced motion — in all those cases the content
 * simply stays in its final, visible state.
 */
export function motionAllowed(win: (Window & typeof globalThis) | null | undefined): boolean {
  if (!win || typeof win.IntersectionObserver !== 'function') {
    return false;
  }
  return !(
    typeof win.matchMedia === 'function' &&
    win.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** True when any part of the element is inside the current viewport (above-the-fold content). */
export function inViewport(el: Element, win: Window): boolean {
  const rect = el.getBoundingClientRect();
  const height = win.innerHeight || win.document.documentElement.clientHeight;
  return rect.top < height && rect.bottom > 0;
}
