// Media Tags loader

import { createRoot } from "react-dom/client";
import Select from "react-select";

export function setupMediaTags(form) {
  const field = form.querySelector("#id_article_media-tags");
  const mount = document.createElement("div");
  const root = createRoot(mount);
  let options = [];
  let status = "loading";
  let pending = [];

  field.hidden = true;
  field.parentNode.insertBefore(mount, field.nextSibling);

  const setTags = (tags) => {
    pending = tags.filter(Boolean);
    const selected = options.filter((option) => tags.includes(option.value));
    const fieldTags = status === "loaded" ? selected.map((option) => option.value) : pending;
    field.value = fieldTags.join(", ");

    root.render(
      <Select
        isMulti
        isDisabled={status !== "loaded"}
        classNamePrefix="article-media-tag-select"
        options={options}
        placeholder={status === "failed" ? "Failed to fetch tags" : "Loading tags"}
        value={selected}
        onChange={(nextOptions) => setTags(nextOptions.map((option) => option.value))}
      />,
    );
  };

  setTags([]);

  fetch(form.dataset.mediaTagsUrl, {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  }).then(async (response) => {
    const payload = await response.json();
    if (!response.ok) throw new Error("Media tags request failed status " + response.status);
    options = payload.tags || [];
    status = "loaded";
    setTags(pending);
  }).catch((error) => {
    console.error(error);
    status = "failed";
    setTags(pending);
  });

  return {
    setTags,
    destroy() {
      root.unmount();
      mount.remove();
    },
  };
}
