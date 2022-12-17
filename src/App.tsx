import { useRef } from 'react';
import { createRenderers } from "./renderer";
import useAsyncEffect from 'use-async-effect';

function App() {
  const containerRef = useRef<HTMLDivElement>(null);

  useAsyncEffect(
    () => containerRef.current 
      ? createRenderers(containerRef.current, 108, 120, 80) : Promise.reject(),
    (dispose) => dispose?.()
    , []);

  return (
    <div>
      <div ref={containerRef} />
    </div>
  );
}

export default App;
