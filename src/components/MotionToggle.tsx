import { useHydrated, useMotion } from '../lib/motion-context';
import { Icon } from './Icon';

/**
 * WCAG 2.2.2 (Pause, Stop, Hide): ambient motion that starts on its own must
 * be stoppable. This switch pauses the sculpture, the simulations and all
 * decorative transitions; the choice persists across visits.
 *
 * Visual state is driven by <html data-motion> (set before first paint), so
 * the control is correct even before React hydrates.
 */
export function MotionToggle({ variant = 'icon', className = '' }: { variant?: 'icon' | 'labelled'; className?: string }) {
  const { enabled, setEnabled } = useMotion();
  const hydrated = useHydrated();

  return (
    <button
      type="button"
      role="switch"
      aria-checked={hydrated ? enabled : true}
      aria-label={variant === 'icon' ? 'Motion' : undefined}
      title="Pause or resume animation"
      className={`motion-toggle motion-toggle--${variant} ${className}`}
      onClick={() => setEnabled(!enabled)}
    >
      {variant === 'labelled' && <span className="motion-toggle__label">Motion</span>}
      <span className="motion-toggle__icon" aria-hidden="true">
        <Icon name="pause" className="icon motion-toggle__pause" />
        <Icon name="play" className="icon motion-toggle__play" />
      </span>
      {variant === 'labelled' && (
        <span className="motion-toggle__track" aria-hidden="true">
          <span className="motion-toggle__thumb" />
        </span>
      )}
    </button>
  );
}
