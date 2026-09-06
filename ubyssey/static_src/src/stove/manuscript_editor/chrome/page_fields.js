import { useEffect } from "react";
import { addListener } from "../../core/events.js";
import { commands } from "@guardian/prosemirror-invisibles/dist/index.mjs";
import { pageEditorState } from "../../core/state.js";
import { COPY_EDITING_MODE_STORAGE_KEY, isCopyEditingModeEnabled } from "../../core/richtext/plugins.js";

// Move this in the future as not a page field
export function useCopyEditingToggle() {
  useEffect(() => {
    const toggle = document.querySelector("#copy-editing-toggle");
    const pageShadow = document.querySelector("[data-page-shadow]");
    if (!toggle || !pageShadow) return undefined;

    const setVisibility = () => {
      window.localStorage.setItem(COPY_EDITING_MODE_STORAGE_KEY, String(toggle.checked));
      pageShadow.classList.toggle("copy-editing-mode", toggle.checked);
      
      const command = commands.setActiveState(toggle.checked);
      pageEditorState.currentPageTextViews().forEach((view) => command(view.state, view.dispatch));
    };

    toggle.checked = isCopyEditingModeEnabled();
    setVisibility();
    return addListener(toggle, "change", setVisibility);
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
