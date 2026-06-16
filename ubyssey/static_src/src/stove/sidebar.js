// Handles the sidebar

export function selectMetadataTab(selected) {
  for (const tab of document.querySelectorAll("[data-metadata-tab]")) {
    tab.setAttribute("aria-selected", String(tab.dataset.metadataTab === selected));
  }
  for (const panel of document.querySelectorAll("[data-metadata-panel]")) {
    panel.hidden = panel.dataset.metadataPanel !== selected;
  }
}

export function setupSidebarResize() {
  const editor = document.querySelector("[data-manuscript-editor]");
  const handle = document.querySelector("[data-metadata-resize-handle]");
  const aside = document.querySelector("[data-metadata-editor]");
  if (!editor || !handle || !aside) return;

  const setWidth = (width) => {
    const max = Math.min(1080, window.innerWidth - 180);
    editor.style.setProperty("--metadata-width", `${Math.max(280, Math.min(max, width))}px`);
  };

  setWidth(Number(localStorage.getItem("metadataEditorWidth")) || aside.getBoundingClientRect().width);

  handle.addEventListener("pointerdown", (event) => {
    handle.setPointerCapture(event.pointerId);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMove = (moveEvent) => {
      const width = editor.getBoundingClientRect().right - moveEvent.clientX;
      setWidth(width);
      localStorage.setItem("metadataEditorWidth", Math.round(width));
    };

    const onUp = () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onUp);
    };

    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
  });
}

// todo: replace alerts
export function setupMediaUpload() {
  const form = document.querySelector("[data-manuscript-form]");
  const button = document.querySelector("[data-article-media-upload-button]");
  if (!form || !button) return;

  const input = (name) => form.querySelector(`#id_article_media-${name}`);
  const kind = input("kind");
  if (!kind) return;

  const reset = () => {
    for (const field of form.querySelectorAll("[name^='article_media-']")) {
      if (field !== kind) field.value = "";
    }
    delete form.dataset.articleMediaEditKind;
    button.textContent = "Upload";
  };

  const sync = () => {
    for (const row of document.querySelectorAll("[data-article-media-image-only]")) row.hidden = kind.value !== "image";
    if (input("media_id")?.value && kind.value !== form.dataset.articleMediaEditKind) reset();
  };

  const edit = (card) => {
    for (const name of ["id", "kind", "title", "author", "description", "tags"]) {
      const field = input(name === "id" ? "media_id" : name);
      if (field) field.value = card.dataset[name] || "";
    }
    input("file").value = "";
    form.dataset.articleMediaEditKind = card.dataset.kind;
    button.textContent = "Edit";
    sync();
  };

  const editFromGallery = (event) => {
    if (event.type === "keydown" && !["Enter", " "].includes(event.key)) return;
    const card = event.target.closest("[data-article-media-item]");
    if (!card) return;
    event.preventDefault();
    edit(card);
  };
  form.addEventListener("click", editFromGallery);
  form.addEventListener("keydown", editFromGallery);
  kind.addEventListener("change", sync);
  sync();

  if (!form.dataset.mediaUploadUrl) return;
  button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      const response = await fetch(form.dataset.mediaUploadUrl, { method: "POST", body: new FormData(form) });
      const payload = await response.json();
      if (!response.ok) {
        alert(`Upload failed: ${JSON.stringify(payload.errors || payload)}`);
        return;
      }

      document.querySelector("[data-article-media-gallery]").outerHTML = payload.gallery;
      const selector = `.pm-control-field--${payload.item.kind} select${payload.item.kind === "image" ? ",select[name='featured_media-image']" : ""}`;
      for (const select of document.querySelectorAll(selector)) {
        const option = Array.from(select.options).find((item) => String(item.value) === String(payload.item.id)) || select.appendChild(new Option());
        option.value = payload.item.id;
        option.textContent = payload.item.title;
      }

      reset();
      sync();
    } catch (error) {
      alert("Upload failed.");
    } finally {
      button.disabled = false;
    }
  });
}
