import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { registerSW } from 'virtual:pwa-register';
import { limpiarCacheAlSalir } from './pwa/limpiarCacheAlSalir';

// Registra el service worker. Con registerType 'autoUpdate', cuando un deploy
// nuevo toma el control, la pestaña se recarga sola: si no, seguiría pidiendo
// chunks del deploy viejo que ya no existen y la siguiente ruta sin visitar
// fallaría. El navegador busca versiones nuevas al abrir la app, así que la
// recarga ocurre justo después de abrirla, no a mitad de una edición larga.
registerSW({ immediate: true });
limpiarCacheAlSalir();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
