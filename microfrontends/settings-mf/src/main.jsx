// Standalone dev entry — only used when running this micro-frontend on its own
// (npm run dev). When loaded by the shell, the shell renders ./App.jsx directly via
// Module Federation and never touches this file.
import React from 'react';
import ReactDOM from 'react-dom/client';
import SettingsApp from './App.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SettingsApp />
  </React.StrictMode>
);
