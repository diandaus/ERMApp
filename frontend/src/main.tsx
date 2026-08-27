import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './modules/App';
import { patchFetchForCapacitor } from './utils/apiBase';
import { ErrorBoundary } from './components/ErrorBoundary';
import './App.css';

patchFetchForCapacitor();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);


