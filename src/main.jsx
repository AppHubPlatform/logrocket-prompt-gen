import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import LogRocket from 'logrocket'
import './index.css'
import App from './App.jsx'

LogRocket.init('apphub/ai-prompts', {
  shouldCaptureIP: true,
  console: { isEnabled: true },
  network: { isEnabled: true },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
