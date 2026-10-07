/**
 * Opens an external URL (Google Maps directions, etc.) in the same tab.
 *
 * `window.open(url, "_blank")` leaves an empty Safari tab behind on iOS once the Maps app
 * takes over the link. Navigating the current tab instead lets iOS hand the universal link
 * to the Maps app while the app's tab stays put; on desktop the page simply navigates and
 * the user can go back.
 */
export function openExternal(url: string) {
  window.location.assign(url);
}
