// Vercel entrypoint (Express preset): serves the default-exported app as one function.
// The app is built in app.js; local development uses dev-server.js, which calls listen().
export { default } from './app.js';
