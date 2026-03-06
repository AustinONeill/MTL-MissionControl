import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { StackProvider, StackTheme } from '@stackframe/stack'
import { stackApp, stackInitError } from './stack'
import ErrorBoundary from './components/ErrorBoundary'
import './index.css'
import App from './App.jsx'

function Root() {
  if (stackInitError) {
    return (
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    )
  }

  return (
    <ErrorBoundary>
      <StackProvider app={stackApp}>
        <StackTheme>
          <App />
        </StackTheme>
      </StackProvider>
    </ErrorBoundary>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
