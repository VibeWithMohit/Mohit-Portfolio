import { CoreStill } from '../../components/CoreStill';
import { Icon } from '../../components/Icon';
import { coreStore, useCoreStore } from '../../lib/coreStore';

/**
 * The hero's anchor for the sculpture: a CSS-positioned box the live scene
 * attaches to, holding the still that paints first. On phones, a button
 * offers the live scene instead of assuming it.
 */
export function CoreStage() {
  const { mode, offer3d } = useCoreStore();
  return (
    <div className="core-stage">
      <div className="core-anchor core-stage__anchor" data-anchor="core" data-base="#f5f4f0" aria-hidden="true">
        <CoreStill state="core" eager />
      </div>
      {offer3d && mode === 'poster' && (
        <button
          type="button"
          className="button button--small glass glass--interactive core-stage__optin"
          onClick={() => coreStore.request3d()}
        >
          <Icon name="play" className="icon" />
          View in 3D
        </button>
      )}
    </div>
  );
}
