import type {
  NavigationAction,
  NavigationState,
  ParamListBase,
  Router,
  RouterConfigOptions,
  StackNavigationState,
} from "expo-router/react-navigation";

const JOB_ROUTE = "job/[id]";

interface OpenRouteAction {
  type: string;
  target?: string;
  payload?: { name?: string; params?: object; path?: string };
}

/**
 * The root stack's state when a job is opened while a job sheet is already up: the screens above
 * that sheet (the image or PDF viewer) are closed and the sheet shows the new job, so there is
 * never more than one job sheet and Back closes it. Returns null for every other action.
 *
 * Expo Router's `dangerouslySingular` isn't used for this: it moves the sheet above a viewer, and
 * react-native-screens crashes when modals are reordered.
 */
export function getStateForOpenJob<State extends NavigationState>(
  state: State,
  action: OpenRouteAction,
): { state: State; affectedRouteKey: string } | null {
  if (action.type !== "PUSH" && action.type !== "NAVIGATE") return null;
  if (action.payload?.name !== JOB_ROUTE) return null;
  if (action.target !== undefined && action.target !== state.key) return null;

  // Routes after `index` are preloaded ones, not on screen
  const activeRoutes = state.routes.slice(0, state.index + 1);
  const preloadedRoutes = state.routes.slice(state.index + 1);
  const sheetIndex = activeRoutes.findIndex((route) => route.name === JOB_ROUTE);
  if (sheetIndex === -1) return null;

  const sheet = activeRoutes[sheetIndex];
  const nextSheet = {
    ...sheet,
    // A new job (or tab) replaces the old params, like a push would
    params: action.payload.params,
    path: action.type === "NAVIGATE" ? action.payload.path : undefined,
  };
  return {
    state: {
      ...state,
      index: sheetIndex,
      routes: [...activeRoutes.slice(0, sheetIndex), nextSheet, ...preloadedRoutes],
    } as State,
    affectedRouteKey: sheet.key,
  };
}

type StackState = StackNavigationState<ParamListBase>;

/** For the root Stack's `UNSTABLE_router`: keeps a single job sheet (see getStateForOpenJob) */
export function singleJobSheetRouter<Action extends NavigationAction>(
  original: Router<StackState, Action>,
): Partial<Router<StackState, Action>> {
  return {
    getStateForAction(state: StackState, action: Action, options: RouterConfigOptions) {
      return (
        getStateForOpenJob(state, action as OpenRouteAction) ??
        original.getStateForAction(state, action, options)
      );
    },
  };
}
