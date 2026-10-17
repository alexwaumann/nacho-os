/**
 * Opens an external URL (Google Maps directions, etc.) in the same tab.
 *
 * `window.open(url, "_blank")` leaves an empty Safari tab behind on iOS once the Maps app
 * takes over the link. Navigating the current tab instead lets iOS hand the universal link
 * to the Maps app while the app's tab stays put; on desktop the page simply navigates and
 * the user can go back.
 *
 * In the Capacitor iOS shell no special handling is needed: Capacitor's navigation delegate
 * cancels any top-level navigation to a host outside `server.url` / `server.allowNavigation`
 * (see capacitor.config.ts) and hands the URL to iOS, so Google Maps (or Safari) opens and the
 * app's web view stays on the current page.
 */
export function openExternal(url: string) {
  window.location.assign(url);
}
