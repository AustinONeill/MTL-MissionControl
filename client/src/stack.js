import { StackClientApp } from '@stackframe/stack'

const projectId            = import.meta.env.VITE_STACK_PROJECT_ID
const publishableClientKey = import.meta.env.VITE_STACK_PUBLISHABLE_CLIENT_KEY

export let stackApp = null
export let stackInitError = null

if (!projectId || !publishableClientKey) {
  stackInitError = `Stack Auth env vars missing at build time.\n  VITE_STACK_PROJECT_ID=${projectId ?? '(undefined)'}\n  VITE_STACK_PUBLISHABLE_CLIENT_KEY=${publishableClientKey ? '(set)' : '(undefined)'}`
  console.error('[MTL]', stackInitError)
} else {
  try {
    stackApp = new StackClientApp({
      projectId,
      publishableClientKey,
      // 'cookie' is required for PKCE OAuth flow to survive the redirect.
      // If getAuthJson() returns no accessToken, the issue is on Stack Auth's side.
      tokenStore: 'cookie',
      urls: {
        home:         '/',
        afterSignIn:  '/',
        afterSignOut: '/',
      },
    })
    console.log('[MTL] Stack Auth initialized OK — project:', projectId)
  } catch (err) {
    stackInitError = `StackClientApp constructor threw: ${err.message}\n${err.stack}`
    console.error('[MTL]', stackInitError)
  }
}
