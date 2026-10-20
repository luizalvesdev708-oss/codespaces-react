import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  const registerServiceWorker = () => {
    void navigator.serviceWorker.register('/service-worker.js')
      .then((registration) => {
        window.dispatchEvent(new CustomEvent('pwa-registration', { detail: registration }));
      })
      .catch((error: unknown) => console.error('Não foi possível ativar o modo PWA offline.', error));
  };
  if (document.readyState === 'complete') registerServiceWorker();
  else window.addEventListener('load', registerServiceWorker, { once: true });
}