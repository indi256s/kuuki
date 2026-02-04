/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

// CSS modules
declare module '*.css' {
  const content: { [className: string]: string }
  export default content
}
