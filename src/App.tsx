import { useRef } from 'react';
import { createRenderers } from "./renderer";
import useAsyncEffect from 'use-async-effect';

function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const consoleRef = useRef<HTMLSpanElement>(null);

  useAsyncEffect(
    () => containerRef.current && consoleRef.current
      ? createRenderers(containerRef.current, consoleRef.current, 128, 96, 64) : Promise.reject(),
    (dispose) => dispose?.()
    , []);

  return (
    <div>
      <code ref={consoleRef} />
      <div ref={containerRef} />
    </div>
  );
}

export default App;
