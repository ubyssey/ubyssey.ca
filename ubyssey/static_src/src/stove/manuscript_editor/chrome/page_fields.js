import { useEffect } from "react";
import { addListener } from "../../core/events.js";
import { commands } from "@guardian/prosemirror-invisibles/dist/index.mjs";
import { pageEditorState } from "../../core/state.js";
import { ARIAL_MODE_STORAGE_KEY, INVISIBLE_CHARACTERS_STORAGE_KEY, areInvisibleCharactersEnabled, isArialModeEnabled } from "../../core/richtext/plugins.js";

const FREEZE_FOOTNOTES_STORAGE_KEY = "manuscript-freeze-footnotes";

// Move this in the future as not a page field
export function useCopyEditingToggles() {
  useEffect(() => {
    const arialToggle = document.querySelector("#arial-toggle");
    const invisibleCharactersToggle = document.querySelector("#invisible-characters-toggle");
    const freezeFootnotesToggle = document.querySelector("#freeze-footnotes-toggle");
    const pageShadow = document.querySelector("[data-page-shadow]");
    if (!arialToggle || !invisibleCharactersToggle || !freezeFootnotesToggle || !pageShadow) return undefined;

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

    arialToggle.checked = isArialModeEnabled();
    invisibleCharactersToggle.checked = areInvisibleCharactersEnabled();
    freezeFootnotesToggle.checked = window.localStorage.getItem(FREEZE_FOOTNOTES_STORAGE_KEY) === "true";
    setArial();
    setInvisibleCharacters();
    setFootnotesFrozen();

    const cleanups = [
      addListener(arialToggle, "change", setArial),
      addListener(invisibleCharactersToggle, "change", setInvisibleCharacters),
      addListener(freezeFootnotesToggle, "change", setFootnotesFrozen),
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
