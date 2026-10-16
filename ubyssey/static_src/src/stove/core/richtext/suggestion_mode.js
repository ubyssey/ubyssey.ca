export const ACTIVE_SUGGESTION_THREAD_META = "activeSuggestionThread";

let suggestionMode = false;

export function suggestionModeIsActive() {
  return suggestionMode;
}

export function toggleSuggestionMode() {
  suggestionMode = !suggestionMode;
  return suggestionMode;
}
