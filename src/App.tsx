import { useEffect } from 'react';
import { CoreLayer } from './components/CoreLayer';
import { SiteFooter } from './components/SiteFooter';
import { SiteHeader } from './components/SiteHeader';
import { detectRefractionSupport, installGlassPointer } from './lib/glassPointer';
import { installMagnetic } from './lib/magnetic';
import { MotionProvider } from './lib/MotionProvider';
import { installAnchorNavigation } from './lib/navigation';
import { initReveal } from './lib/reveal';
import { About } from './sections/about/About';
import { Contact } from './sections/contact/Contact';
import { Experience } from './sections/experience/Experience';
import { Lab } from './sections/lab/Lab';
import { Signal } from './sections/signal/Signal';
import { SystemsMap } from './sections/systems/SystemsMap';
import { SelectedWork } from './sections/work/SelectedWork';

export function App() {
  useEffect(() => {
    if (detectRefractionSupport()) document.documentElement.classList.add('supports-refraction');
    const stopReveal = initReveal();
    const stopAnchors = installAnchorNavigation();
    const stopGlass = installGlassPointer();
    const stopMagnetic = installMagnetic();
    return () => {
      stopReveal();
      stopAnchors();
      stopGlass();
      stopMagnetic();
    };
  }, []);

  return (
    <MotionProvider>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <SiteHeader />
      <CoreLayer />
      <main id="main">
        <Signal />
        <SelectedWork />
        <SystemsMap />
        <Experience />
        <Lab />
        <About />
        <Contact />
      </main>
      <SiteFooter />
    </MotionProvider>
  );
}
