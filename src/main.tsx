import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { OpsProvider } from './app/OpsContext';
import './styles/globals.css';
import { registerServiceWorker } from './utils/registerSW';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <OpsProvider>
        <App />
      </OpsProvider>
    </BrowserRouter>
  </React.StrictMode>
);

registerServiceWorker();
