/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_ENABLE_DEV_TOOLS?: string;
  readonly VITE_MEDIAPIPE_WASM_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
