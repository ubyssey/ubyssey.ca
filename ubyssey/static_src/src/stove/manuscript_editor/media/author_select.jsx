// Author select

import { createRoot } from "react-dom/client";
import Select from "react-select";

import { fetchAuthorOptions } from "../metadata/authors_options.js";

export function setupMediaAuthorSelect(form) {
  const field = form.querySelector("[data-article-media-author-select]");
  const mount = document.createElement("div");
  const root = createRoot(mount);
  let loaded = false;

  field.hidden = true;
  field.parentNode.insertBefore(mount, field.nextSibling);

  const render = (options, isDisabled = false) => {
    root.render(
      <Select
        classNamePrefix="article-media-author-select"
        isDisabled={isDisabled}
        options={options}
        placeholder={isDisabled ? "Loading authors" : "Select author"}
        value={options.find((option) => String(option.value) === String(field.value)) || null}
        onChange={(option) => {
          field.value = option?.value || "";
          field.dispatchEvent(new Event("change", { bubbles: true }));
        }}
      />,
    );
  };

  const optionsFromField = () => Array.from(field.options).map((option) => ({
    value: option.value,
    label: option.text,
  }));

  render([], true);
  const optionsReady = fetchAuthorOptions(form).then((payload) => {
    const selectedAuthorId = field.dataset.pendingValue ?? field.value;
    const options = [
      { value: "", label: "Select author" },
      ...(payload.authors || []).map((author) => ({ value: author.id, label: author.label })),
    ];
    field.replaceChildren(...options.map((option) => new Option(option.label, option.value)));
    field.value = selectedAuthorId;

    loaded = true;
    delete field.dataset.pendingValue;

    render(options);
    return true;
  }).catch((error) => {
    console.error(error);
    field.options[0].textContent = "Failed to fetch authors";

    render([], true);
    return false;
  });

  return {
    field,
    optionsReady,
    optionsFromField,
    render,
    get loaded() { return loaded; },
    destroy() {
      root.unmount();
      mount.remove();
    },
  };
}
