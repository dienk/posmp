/// <reference types="vite/client" />

// Import SQL schema sebagai string mentah.
declare module '*.sql?raw' {
  const content: string
  export default content
}
