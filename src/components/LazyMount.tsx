import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Renders `fallback` (also during prerender and hydration) and swaps in
 * `children` — typically a React.lazy component — once the placeholder comes
 * within `rootMargin` of the viewport. Keeps heavy, interactive code out of
 * the initial download without hiding any essential content.
 */
export function LazyMount({
  children,
  fallback,
  rootMargin = '700px 0px',
  className,
}: {
  children: ReactNode;
  fallback: ReactNode;
  rootMargin?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setMounted(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [rootMargin]);

  return (
    <div ref={ref} className={className}>
      {mounted ? <Suspense fallback={fallback}>{children}</Suspense> : fallback}
    </div>
  );
}
