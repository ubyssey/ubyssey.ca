import { useEffect } from "react";
import { addListener } from "../../core/events.js";
import { commands } from "@guardian/prosemirror-invisibles/dist/index.mjs";
import { pageEditorState } from "../../core/state.js";
import {
  ARIAL_MODE_STORAGE_KEY,
  INVISIBLE_CHARACTERS_STORAGE_KEY,
  TRAILING_SUGGESTION_SPACE_STORAGE_KEY,
  SELECTION_COMMENT_BUTTON_STORAGE_KEY,
  areInvisibleCharactersEnabled,
  isArialModeEnabled,
  isTrailingSuggestionSpaceEnabled,
  isSelectionCommentButtonEnabled,
} from "../../core/richtext/plugins.js";

const FREEZE_FOOTNOTES_STORAGE_KEY = "manuscript-freeze-footnotes";

// Move this in the future as not a page field
export function useCopyEditingToggles() {
  useEffect(() => {
    const arialToggle = document.querySelector("#arial-toggle");
    const invisibleCharactersToggle = document.querySelector("#invisible-characters-toggle");
    const freezeFootnotesToggle = document.querySelector("#freeze-footnotes-toggle");
    const trailingSuggestionSpaceToggle = document.querySelector("#trailing-suggestion-space-toggle");
    const selectionCommentButtonToggle = document.querySelector("#selection-comment-button-toggle");
    
    const pageShadow = document.querySelector("[data-page-shadow]");
    if (!arialToggle || !invisibleCharactersToggle || !freezeFootnotesToggle || !trailingSuggestionSpaceToggle || !selectionCommentButtonToggle || !pageShadow) return undefined;

    const setArial = () => {
      window.localStorage.setItem(ARIAL_MODE_STORAGE_KEY, String(arialToggle.checked));
      pageShadow.classList.toggle("arial-mode", arialToggle.checked);
    };

    const setInvisibleCharacters = () => {
      window.localStorage.setItem(INVISIBLE_CHARACTERS_STORAGE_KEY, String(invisibleCharactersToggle.checked));
      const command = commands.setActiveState(invisibleCharactersToggle.checked);
      pageEditorState.currentPageTextViews().forEach((view) => command(view.state, view.dispatch));
    };

    const setFootnotesFrozen = () => {
      pageEditorState.footnotesFrozen = freezeFootnotesToggle.checked;
      window.localStorage.setItem(FREEZE_FOOTNOTES_STORAGE_KEY, String(freezeFootnotesToggle.checked));
      pageShadow.classList.toggle("footnotes-frozen", freezeFootnotesToggle.checked);
    };

    const setTrailingSuggestionSpace = () => {
      window.localStorage.setItem(TRAILING_SUGGESTION_SPACE_STORAGE_KEY, String(trailingSuggestionSpaceToggle.checked));
    };

    const setSelectionCommentButton = () => {
      window.localStorage.setItem(SELECTION_COMMENT_BUTTON_STORAGE_KEY, String(selectionCommentButtonToggle.checked));
      pageEditorState.currentPageTextViews().forEach((view) => view.dispatch(view.state.tr));
    };

    arialToggle.checked = isArialModeEnabled();
    invisibleCharactersToggle.checked = areInvisibleCharactersEnabled();
    freezeFootnotesToggle.checked = window.localStorage.getItem(FREEZE_FOOTNOTES_STORAGE_KEY) === "true";
    trailingSuggestionSpaceToggle.checked = isTrailingSuggestionSpaceEnabled();
    selectionCommentButtonToggle.checked = isSelectionCommentButtonEnabled();
    
    setArial();
    setInvisibleCharacters();
    setFootnotesFrozen();
    setTrailingSuggestionSpace();
    setSelectionCommentButton();

    const cleanups = [
      addListener(arialToggle, "change", setArial),
      addListener(invisibleCharactersToggle, "change", setInvisibleCharacters),
      addListener(freezeFootnotesToggle, "change", setFootnotesFrozen),
      addListener(trailingSuggestionSpaceToggle, "change", setTrailingSuggestionSpace),
      addListener(selectionCommentButtonToggle, "change", setSelectionCommentButton),
    ];
    return () => cleanups.forEach((cleanup) => cleanup());
  }, []);
}

// Unique for manuscript for now, potentially remove (though I like how they look)
export function usePageFieldToggles(form, schedulePreview) {
  useEffect(() => {
    const cleanups = Array.from(document.querySelectorAll("[data-page-field-toggle]")).flatMap((toggle) => {
      const field = form.elements.namedItem(toggle.dataset.pageFieldToggle);

      const syncToggle = () => {
        toggle.checked = Boolean(String(field.value).trim());
      };

      const onToggleChange = () => {
        if (toggle.checked) {
          field.value = toggle.dataset.pageFieldBoilerplate;
        } else if (String(field.value).trim() && !window.confirm("Remove this field? Its current text will not be saved.")) {
          toggle.checked = true;
          return;
        } else {
          field.value = "";
        }

        field.dispatchEvent(new Event("input", { bubbles: true }));
        form.dispatchEvent(new Event("input", { bubbles: true }));
        schedulePreview({ immediate: true });
      };

      syncToggle();
      return [
        addListener(field, "input", syncToggle),
        addListener(toggle, "change", onToggleChange),
      ];
    });

    return () => cleanups.forEach((cleanup) => cleanup());
  }, [form, schedulePreview]);
}
