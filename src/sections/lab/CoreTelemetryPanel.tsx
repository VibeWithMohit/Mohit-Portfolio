import { useCoreTelemetry, type CoreStatus } from '../../lib/telemetry';

const STATUS_LABEL: Record<CoreStatus, string> = {
  pending: 'Waiting',
  static: 'Still image',
  loading: 'Loading',
  running: 'Rendering',
  idle: 'Not rendering',
  failed: 'Static fallback',
};

/**
 * Experiment 03 — the hero sculpture's own render loop, observed. The
 * numbers come straight from the scene (src/three/liquidCore.ts), so the
 * "renders only when visible and changing" claim can be checked live.
 */
export function CoreTelemetryPanel() {
  const t = useCoreTelemetry();
  const rows: [string, string][] = [
    ['Frames rendered', String(t.framesRendered)],
    ['Frame rate', t.status === 'running' && t.fps > 0 ? `${t.fps} fps` : '0 fps'],
    ['Device tier', t.tier ?? '—'],
    ['Pixel ratio', t.pixelRatio ? `${t.pixelRatio}×` : '—'],
    ['Draw calls', t.drawCalls ? String(t.drawCalls) : '—'],
    ['Triangles', t.triangles ? t.triangles.toLocaleString('en-IN') : '—'],
    ['CPU per frame', t.cpuFrameMs ? `${t.cpuFrameMs} ms` : '—'],
  ];

  return (
    <div className="telemetry">
      <p className="telemetry__status" data-status={t.status}>
        <span className="telemetry__led" aria-hidden="true" />
        {STATUS_LABEL[t.status]}
      </p>
      <p className="telemetry__reason">{t.reason}</p>
      <dl className="telemetry__grid">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="label">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <p className="telemetry__hint">
        While you read this, the sculpture is off-screen — so the frame count should be standing still.{' '}
        <a className="link" href="#top">
          Scroll up to it
        </a>{' '}
        and come back: the count will have moved only while it was visible.
      </p>
    </div>
  );
}
