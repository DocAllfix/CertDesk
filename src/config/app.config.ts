export const APP_CONFIG = {
  // Identità
  appName:     import.meta.env.VITE_APP_NAME     ?? 'CertDesk',
  clienteName: import.meta.env.VITE_CLIENTE_NAME ?? '',
  logoUrl:     import.meta.env.VITE_LOGO_URL     ?? '/logo-default.svg',
  faviconUrl:  import.meta.env.VITE_FAVICON_URL  ?? '/favicon.svg',

  // Tema colori
  primaryColor: import.meta.env.VITE_PRIMARY_COLOR ?? '#3b82f6',
  accentColor:  import.meta.env.VITE_ACCENT_COLOR  ?? '#8b5cf6',

  // Funzionalità: null = tutte le 17 norme abilitate
  norme: import.meta.env.VITE_NORME_ABILITATE
    ? (JSON.parse(import.meta.env.VITE_NORME_ABILITATE) as string[])
    : null,

  // Supabase (solo chiave anonima — mai service_role nel frontend)
  supabaseUrl:     import.meta.env.VITE_SUPABASE_URL,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
}
