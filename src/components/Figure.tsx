import type { ReactNode } from 'react';

/** A numbered figure with an honest caption describing exactly what it shows. */
export function Figure({
  number,
  label,
  caption,
  children,
  className = '',
  frameClassName = '',
}: {
  number: string;
  label: string;
  caption: ReactNode;
  children: ReactNode;
  className?: string;
  frameClassName?: string;
}) {
  return (
    <figure className={`fig ${className}`} data-reveal="clip">
      <div className={`fig__frame surface ${frameClassName}`}>{children}</div>
      <figcaption className="fig__caption">
        <span className="label fig__label">
          Fig. {number} — {label}
        </span>
        <span>{caption}</span>
      </figcaption>
    </figure>
  );
}
