import './utils/fixBrowserRouterPath'; // сначала: вырезает #redirect=<путь> из URL до создания BrowserRouter
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
