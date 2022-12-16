import { useRef } from 'react';
import './App.css';
import { createRenderers } from "./renderer";
import useAsyncEffect from 'use-async-effect/types';

function App() {
  const appRef = useRef<HTMLDivElement>(null);

  useAsyncEffect(
    () => appRef.current ? createRenderers(appRef.current, 16, 192, 128) : Promise.reject(),
    (dispose) => dispose?.()
    , []);

  return (
    <div ref={appRef} className="App">
      <span>Loading...</span>
    </div>
  );
}

export default App;
