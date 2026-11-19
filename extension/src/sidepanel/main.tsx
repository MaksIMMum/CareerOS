import React from 'react';
import ReactDOM from 'react-dom/client';
// The website's Amplify (Cognito) setup, i18n and styles — the same accounts and design.
import '../../../frontend/src/lib/auth.js';
import '../../../frontend/src/i18n.js';
import '../../../frontend/src/index.css';
import './panel.css';
import { App } from './App.js';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
