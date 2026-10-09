import './utils/fixBrowserRouterPath'; // сначала: вырезает #redirect=<путь> из URL до создания BrowserRouter
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Регистрация Service Worker для PWA и Web Push.
// './sw.js' — относительный путь: Vite отдаёт public/sw.js с корректным scope
// и при деплое в корень, и в подпапку (base = '/family-hub/').
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .then((registration) => {
        console.log('SW registered:', registration.scope);
      })
      .catch((err: unknown) => {
        console.error('Ошибка регистрации Service Worker:', err);
      });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
