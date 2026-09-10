// Build time configuration, read by utils/api.ts. WXT exposes any variable
// prefixed with WXT_ on import.meta.env; these merge into the interface it
// generates in .wxt/types/globals.d.ts.
interface ImportMetaEnv {
  /** API server the extension talks to, e.g. https://my-app-server.fly.dev */
  readonly WXT_SERVER_URL?: string;
  /** Dashboard the popup links to, e.g. https://my-app-client.fly.dev */
  readonly WXT_DASHBOARD_URL?: string;
}
