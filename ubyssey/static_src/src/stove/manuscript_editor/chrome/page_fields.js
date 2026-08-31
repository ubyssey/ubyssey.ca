import { useEffect } from "react";
import { addListener } from "../../core/events.js";

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
