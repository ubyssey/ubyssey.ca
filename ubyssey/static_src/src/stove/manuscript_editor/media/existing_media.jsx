// Existing media search to add to page

import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import AsyncSelect from "react-select/async";

export function setupExistingMediaPicker({ form, kindField, mount, addButton }) {
  const root = createRoot(mount);
  let controller = null;
  let timer = null;
  let resolvePending = null;
  let selection = null;

  const cancelSearch = () => {
    if (timer) window.clearTimeout(timer);
    timer = null;

    if (controller) controller.abort();
    controller = null;

    if (resolvePending) resolvePending([]);
    resolvePending = null;
  };

  const loadOptions = (inputValue) => new Promise((resolve) => {
    cancelSearch();
    resolvePending = resolve;

    timer = window.setTimeout(async () => {
      timer = null;
      const nextController = new AbortController();
      controller = nextController;
      const url = new URL(form.dataset.mediaOptionsUrl, window.location.origin);
      url.searchParams.set("kind", kindField.value);
      url.searchParams.set("q", inputValue.trim());

      try {
        const response = await fetch(url, {
          credentials: "same-origin",
          headers: { Accept: "application/json" },
          signal: nextController.signal,
        });
        const payload = await response.json();
        if (!response.ok) throw new Error("Media Search Failed: " + response.status);
        resolve(payload.options || []);
      } catch (error) {
        if (error.name !== "AbortError") console.error(error);
        resolve([]);
      } finally {
        if (controller === nextController) controller = null;
        if (resolvePending === resolve) resolvePending = null;
      }
    }, 250);
  });

  const render = () => {
    cancelSearch();
    selection = null;
    addButton.disabled = true;
    flushSync(() => {
      root.render(
        <AsyncSelect
          key={kindField.value}
          cacheOptions
          defaultOptions
          classNamePrefix="article-media-existing-select"
          loadOptions={loadOptions}
          placeholder="Search media..."
          loadingMessage={() => "Loading media..."}
          noOptionsMessage={({ inputValue }) => (inputValue ? "No matching media" : "No media found")}
          onChange={(option) => {
            selection = option;
            addButton.disabled = !option;
          }}
        />,
      );
    });
  };

  return {
    render,
    cancelSearch,
    get selection() { return selection; },
    destroy() {
      cancelSearch();
      root.unmount();
    },
  };
}
