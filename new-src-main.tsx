import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import App from './App.tsx';
import './index.css';

// Enable React concurrent features
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <Toaster 
        position="top-right"
        expand={true}
        richColors={true}
        closeButton={true}
        toastOptions={{
          duration: 4000,
          style: {
            background: 'white',
            border: '1px solid #e5e7eb',
            fontSize: '14px'
          }
        }}
      />
    </BrowserRouter>
  </React.StrictMode>
);

// Development tools and debugging
if (import.meta.env.DEV) {
  console.log('🔧 Development mode enabled');
  console.log('Environment variables:', {
    VITE_DIFY_API_URL: import.meta.env.VITE_DIFY_API_URL,
    VITE_DIFY_APP_ID: import.meta.env.VITE_DIFY_APP_ID ? `${import.meta.env.VITE_DIFY_APP_ID.substring(0, 8)}...` : 'Not set',
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL ? `${import.meta.env.VITE_SUPABASE_URL.substring(0, 30)}...` : 'Not set',
    NODE_ENV: import.meta.env.MODE
  });
}

// Service worker registration (optional, for PWA features)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registered: ', registration);
      })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}