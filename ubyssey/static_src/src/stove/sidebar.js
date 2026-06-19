// Handles the sidebar


export function selectMetadataTab(selected) {
  for (const tab of document.querySelectorAll("[data-metadata-tab]")) {
    tab.setAttribute("aria-selected", String(tab.dataset.metadataTab === selected));
  }
  for (const panel of document.querySelectorAll("[data-metadata-panel]")) {
    panel.hidden = panel.dataset.metadataPanel !== selected;
  }
}

// todo: replace alerts
export function setupMediaUpload() {
  const form = document.querySelector("[data-manuscript-form]");
  const button = document.querySelector("[data-article-media-upload-button]");
  if (!form || !button) return;

  const openSettingsButton = document.querySelector("[data-manuscript-open-settings]");
  const openUploadButton = document.querySelector("[data-article-media-open-upload]");
  const openGalleryButton = document.querySelector("[data-article-media-open-gallery]");
  const settingsModal = document.querySelector("[data-manuscript-settings-modal]");
  const uploadModal = document.querySelector("[data-article-media-upload-modal]");
  const galleryModal = document.querySelector("[data-article-media-gallery-modal]");
  const uploadTitle = document.querySelector("[data-article-media-upload-title]");
  let uploadReturnsToGallery = false;

  const input = (name) => form.querySelector(`#id_article_media-${name}`);
  const kind = input("kind");
  if (!kind) return;

  const setUploadMode = (mode) => {
    const editing = mode === "edit";
    if (uploadTitle) uploadTitle.textContent = editing ? "Edit media" : "Upload media";
    button.textContent = editing ? "Save" : "Upload";
  };

  const openModal = (modal, focusTarget = null) => {
    if (!modal) return;
    modal.hidden = false;
    document.body.classList.add("article-media-modal-open");
    window.requestAnimationFrame(() => {
      (focusTarget || modal.querySelector("input:not([type='hidden']), select, textarea, button"))?.focus();
    });
  };

  const closeModal = (modal) => {
    if (!modal) return;
    modal.hidden = true;
    if (!document.querySelector(".article-media-modal:not([hidden])")) {
      document.body.classList.remove("article-media-modal-open");
    }
  };

  const focusGallery = () => {
    if (galleryModal?.hidden) return;
    window.requestAnimationFrame(() => {
      galleryModal.querySelector("[data-article-media-edit-button], a, button")?.focus();
    });
  };

  const reset = () => {
    for (const field of form.querySelectorAll("[name^='article_media-']")) {
      if (field !== kind) field.value = "";
    }
    delete form.dataset.articleMediaEditKind;
    setUploadMode("upload");
  };

  const closeUploadModal = () => {
    const shouldFocusGallery = uploadReturnsToGallery;
    closeModal(uploadModal);
    uploadModal?.classList.remove("article-media-modal--stacked");
    uploadReturnsToGallery = false;
    reset();
    sync();
    if (shouldFocusGallery) focusGallery();
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
    const file = input("file");
    if (file) file.value = "";
    form.dataset.articleMediaEditKind = card.dataset.kind;
    setUploadMode("edit");
    sync();
    uploadReturnsToGallery = !galleryModal?.hidden;
    uploadModal?.classList.toggle("article-media-modal--stacked", uploadReturnsToGallery);
    openModal(uploadModal, input("title"));
  };

  form.addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-article-media-edit-button]");
    if (!editButton) return;

    const card = editButton.closest("[data-article-media-item]");
    if (!card) return;

    event.preventDefault();
    edit(card);
  });

  openSettingsButton?.addEventListener("click", () => {
    openModal(settingsModal, settingsModal?.querySelector("input, textarea, select, button"));
  });

  openUploadButton?.addEventListener("click", () => {
    uploadReturnsToGallery = false;
    uploadModal?.classList.remove("article-media-modal--stacked");
    reset();
    sync();
    openModal(uploadModal, input("kind"));
  });

  openGalleryButton?.addEventListener("click", () => {
    openModal(galleryModal, galleryModal?.querySelector("[data-article-media-edit-button], a, button"));
  });

  for (const closeButton of document.querySelectorAll("[data-article-media-close], [data-manuscript-settings-close]")) {
    closeButton.addEventListener("click", () => {
      const modal = closeButton.closest("[data-manuscript-settings-modal], [data-article-media-upload-modal], [data-article-media-gallery-modal]");
      if (modal === uploadModal) {
        closeUploadModal();
      } else {
        closeModal(modal);
      }
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!uploadModal?.hidden) {
      closeUploadModal();
      return;
    }
    if (!galleryModal?.hidden) {
      closeModal(galleryModal);
      return;
    }
    if (!settingsModal?.hidden) closeModal(settingsModal);
  });

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

      closeUploadModal();
    } catch (error) {
      alert("Upload failed.");
    } finally {
      button.disabled = false;
    }
  });
}
