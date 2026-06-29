import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import LogRocket from 'logrocket'
import setupLogRocketReactImport from 'logrocket-react'
import './index.css'
import App from './App.jsx'

// logrocket-react ships as CommonJS; under some bundler interop the default
// import resolves to the module object rather than the function itself.
const setupLogRocketReact = setupLogRocketReactImport.default ?? setupLogRocketReactImport

LogRocket.init('apphub/ai-prompts', {
  serverURL: 'https://staging-i.logrocket.com/i',
  dashboardHost: 'https://staging.logrocket.com',
})
setupLogRocketReact(LogRocket)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
