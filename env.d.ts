/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare const APP_VERSION: string;

interface ImportMetaEnv {
  readonly VITE_GROQ_API_KEY?: string;
  readonly VITE_ENCRYPTION_SALT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
