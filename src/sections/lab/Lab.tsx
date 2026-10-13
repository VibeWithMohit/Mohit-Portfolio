import { lazy, type ReactNode } from 'react';
import { LazyMount } from '../../components/LazyMount';
import { SectionHead } from '../../components/SectionHead';
import { CoreTelemetryPanel } from './CoreTelemetryPanel';
import './lab.css';

// Interactive code is fetched only as the reader approaches each experiment.
const LossyChannel = lazy(() => import('./LossyChannel'));
const Rectifier = lazy(() => import('./Rectifier'));

function Fallback({ minHeight }: { minHeight: string }) {
  return (
    <div className="experiment__fallback" style={{ minHeight }}>
      <p className="label">Interactive experiment — loads as you approach it (requires JavaScript).</p>
    </div>
  );
}

function Experiment({
  index,
  id,
  title,
  kind,
  summary,
  note,
  children,
}: {
  index: string;
  id: string;
  title: string;
  kind: string;
  summary: string;
  note: string;
  children: ReactNode;
}) {
  return (
    <article className="experiment" aria-labelledby={`${id}-title`} id={id}>
      <header className="experiment__head" data-reveal>
        <p className="experiment__kind label">
          <span>Experiment {index}</span>
          <span>{kind}</span>
        </p>
        <h3 id={`${id}-title`} className="experiment__title display">
          {title}
        </h3>
        <p className="experiment__summary">{summary}</p>
        <p className="experiment__note">
          <span className="label">Label</span>
          {note}
        </p>
      </header>
      <div className="experiment__body surface">{children}</div>
    </article>
  );
}

export function Lab() {
  return (
    <section id="lab" className="sheet theme-light lab" aria-labelledby="lab-title">
      <div className="container">
        <SectionHead
          id="lab"
          lede="Working experiments, labelled honestly. Everything here runs in your browser; none of it is production code from the projects above."
        />
        <div className="lab__list">
          <Experiment
            index="01"
            id="lossy-channel"
            title="Lossy Channel"
            kind="Fountain codes"
            summary="Type a message and send it through a channel that drops frames. Each frame carries the XOR of a few blocks plus the seed that names them; the decoder peels the message back out of whatever arrives."
            note="A minimal LT fountain code written for this page to show the idea behind BeamTransfer. It is not BeamTransfer’s codec."
          >
            <LazyMount fallback={<Fallback minHeight="34rem" />}>
              <LossyChannel />
            </LazyMount>
          </Experiment>

          <Experiment
            index="02"
            id="perspective-rectifier"
            title="Perspective Rectifier"
            kind="Computer vision"
            summary="Place four corners on a photographed page and watch it stand up straight. A homography is solved from your corners and every output pixel is resampled through it — the heart of document scanning."
            note="Illustrates the technique behind BeamTransfer’s perspective correction, on a synthetic photo. It is not BeamTransfer’s code."
          >
            <LazyMount fallback={<Fallback minHeight="30rem" />}>
              <Rectifier />
            </LazyMount>
          </Experiment>

          <Experiment
            index="03"
            id="core-telemetry"
            title="Core Telemetry"
            kind="Performance"
            summary="The glass sculpture at the top of this page renders only while it is visible and something is changing. These are its live numbers, so that claim can be checked rather than taken on trust."
            note="Read directly from the WebGL render loop of this site."
          >
            <CoreTelemetryPanel />
          </Experiment>
        </div>
      </div>
    </section>
  );
}
