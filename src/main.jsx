import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import LogRocket from 'logrocket'
import setupLogRocketReact from 'logrocket-react'
import './index.css'
import App from './App.jsx'

LogRocket.init('apphub/ai-prompts')
setupLogRocketReact(LogRocket)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
