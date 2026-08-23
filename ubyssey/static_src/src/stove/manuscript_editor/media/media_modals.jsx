import { useEffect } from "react";

import { addListener } from "../../core/events.js";
import { focusableSelector, setModalOpen } from "../../core/chrome/modal.jsx";
import { setupExistingMediaPicker } from "./existing_media.jsx";
import { setupMediaAuthorSelect } from "./author_select.jsx";
import { applyMediaResponse } from "./update_gallery.js";
import { setupMediaTags } from "./media_tags.jsx";

// Coordinates Media Modal Behaviour

export function useMediaModals(form, mediaUpdates) {
  useEffect(() => {
    const uploadButton = document.querySelector("[data-article-media-upload-button]");
    const settingsModal = document.querySelector("[data-manuscript-settings-modal]");
    const coverModal = document.querySelector("[data-manuscript-cover-modal]");
    const guideModal = document.querySelector("[data-manuscript-guide-modal]");
    const uploadModal = document.querySelector("[data-article-media-upload-modal]");
    const galleryModal = document.querySelector("[data-article-media-gallery-modal]");
    const uploadTitle = document.querySelector("[data-article-media-upload-title]");
    const kind = form.elements.namedItem("article_media-kind");
    let uploadReturnsToGallery = false;
    // Sometimes there are layered modals
    const existingMediaModal = document.querySelector("[data-article-media-existing-modal]");
    const existingKind = document.querySelector("[data-article-media-existing-kind]");
    const existingSelectMount = document.querySelector("[data-article-media-existing-select]");
    const existingAddButton = document.querySelector("[data-article-media-existing-add]");
    const existingMedia = setupExistingMediaPicker({
      form,
      kindField: existingKind,
      mount: existingSelectMount,
      addButton: existingAddButton,
    });
    const mediaAuthors = setupMediaAuthorSelect(form);
    const mediaTags = setupMediaTags(form);

    const mediaField = (name) => form.querySelector(`#id_article_media-${name}`);
    const mediaAuthorOptionsReady = mediaAuthors.optionsReady;

    const setUploadMode = (mode) => {
      const editing = mode === "edit";
      uploadTitle.textContent = editing ? "Edit media" : "Upload media";
      uploadButton.textContent = editing ? "Save" : "Upload";
    };

    const reset = () => {
      form.querySelectorAll("[name^='article_media-']").forEach((field) => {
        if (field !== kind) field.value = "";
      });
      mediaTags.setTags([]);
      mediaAuthors.render(Array.from(mediaAuthors.field.options).map((option) => ({ value: option.value, label: option.text })), !mediaAuthors.loaded);
      delete mediaAuthors.field.dataset.pendingValue;
      delete form.dataset.articleMediaEditKind;
      setUploadMode("upload");
    };

    const syncImageFields = () => {
      document.querySelectorAll("[data-article-media-image-only]").forEach((row) => {
        row.hidden = kind.value !== "image";
      });
      if (mediaField("media_id").value && kind.value !== form.dataset.articleMediaEditKind) reset();
    };
    
    const closeUpload = () => {
      const shouldFocusGallery = uploadReturnsToGallery;
      setModalOpen(uploadModal, false);
      uploadModal.classList.remove("page-editor-modal--stacked");
      uploadReturnsToGallery = false;
      reset();
      syncImageFields();
      if (shouldFocusGallery) {
        window.requestAnimationFrame(() => {
          galleryModal.querySelector("[data-article-media-edit-button], a, button").focus();
        });
      }
    };

    const closeExisting = () => {
      existingMedia.cancelSearch();
      setModalOpen(existingMediaModal, false);
      existingMediaModal.classList.remove("page-editor-modal--stacked");
      existingAddButton.disabled = true;
      window.requestAnimationFrame(() => {
        galleryModal.querySelector("[data-article-media-edit-button], a, button").focus();
      });
    };

    const syncRemoteMedia = (event) => {
      if (event.transaction.origin === "article-media") return;
      const payload = mediaUpdates.get("latest");
      if (payload) applyMediaResponse(mediaUpdates, payload, false);
    };
    mediaUpdates.observe(syncRemoteMedia);

    syncImageFields();

    const cleanups = [
      addListener(document.querySelector("[data-manuscript-open-guide]"), "click", () => {
        setModalOpen(guideModal, true, guideModal.querySelector(focusableSelector));
      }),
      addListener(document.querySelector("[data-manuscript-open-cover]"), "click", () => {
        setModalOpen(coverModal, true, coverModal.querySelector(focusableSelector));
      }),
      addListener(document.querySelector("[data-manuscript-open-settings]"), "click", () => {
        setModalOpen(settingsModal, true, settingsModal.querySelector(focusableSelector));
      }),
      addListener(document.querySelector("[data-article-media-open-upload]"), "click", () => {
        uploadReturnsToGallery = !galleryModal.hidden;
        uploadModal.classList.toggle("page-editor-modal--stacked", uploadReturnsToGallery);
        reset();
        syncImageFields();
        setModalOpen(uploadModal, true, kind);
      }),
      addListener(document.querySelector("[data-article-media-open-existing]"), "click", () => {
        existingMediaModal.classList.add("page-editor-modal--stacked");
        existingMedia.render();
        setModalOpen(existingMediaModal, true, existingKind);
      }),
      addListener(form, "click", (event) => {
        const editButton = event.target.closest("[data-article-media-edit-button]");
        if (!editButton) return;

        const card = editButton.closest("[data-article-media-item]");
        event.preventDefault();

        ["id", "kind", "title", "author", "description", "tags"].forEach((name) => {
          const field = mediaField(name === "id" ? "media_id" : name);
          const value = card.dataset[name] || "";
          if (name === "author" && !mediaAuthors.loaded) {
            field.dataset.pendingValue = value;
          }
          field.value = value;
        });

        mediaTags.setTags((card.dataset.tags || "").split(",").map((tag) => tag.trim()));
        mediaAuthors.render(Array.from(mediaAuthors.field.options).map((option) => ({ value: option.value, label: option.text })), !mediaAuthors.loaded);
        mediaField("file").value = "";
        form.dataset.articleMediaEditKind = card.dataset.kind;
        setUploadMode("edit");
        syncImageFields();
        uploadReturnsToGallery = !galleryModal.hidden;
        uploadModal.classList.toggle("page-editor-modal--stacked", uploadReturnsToGallery);
        setModalOpen(uploadModal, true, mediaField("title"));
      }),
      ...Array.from(document.querySelectorAll("[data-article-media-close], [data-manuscript-settings-close], [data-manuscript-cover-close], [data-manuscript-guide-close]")).map((button) => (
        addListener(button, "click", () => {
          const modal = button.closest("[data-manuscript-settings-modal], [data-article-media-upload-modal], [data-article-media-existing-modal], [data-article-media-gallery-modal], [data-manuscript-cover-modal], [data-manuscript-guide-modal]");
          if (modal === uploadModal) closeUpload();
          else if (modal === existingMediaModal) closeExisting();
          else setModalOpen(modal, false);
        })
      )),
      addListener(document, "keydown", (event) => {
        if (event.key !== "Escape") return;
        if (!uploadModal.hidden) closeUpload();
        else if (!existingMediaModal.hidden) closeExisting();
        else if (!settingsModal.hidden) setModalOpen(settingsModal, false);
        else if (!coverModal.hidden) setModalOpen(coverModal, false);
        else if (!guideModal.hidden) setModalOpen(guideModal, false);
      }),
      addListener(kind, "change", syncImageFields),
      addListener(existingKind, "change", existingMedia.render),
      addListener(uploadButton, "click", async () => {
        uploadButton.disabled = true;
        try {
          const authorsAvailable = await mediaAuthorOptionsReady;
          if (!authorsAvailable && mediaField("media_id").value) {
            window.alert("Cannot edit media until authors are loaded. Though it probably shouldn't be taking this long.");
            return;
          }
          const response = await fetch(form.dataset.mediaUploadUrl, { method: "POST", body: new FormData(form) });
          const payload = await response.json();
          if (!response.ok) {
            window.alert(`Upload failed: ${JSON.stringify(payload.errors || payload)}`);
            return;
          }

          applyMediaResponse(mediaUpdates, payload);

          closeUpload();
        } catch (error) {
          window.alert("Upload failed.");
        } finally {
          uploadButton.disabled = false;
        }
      }),
      addListener(existingAddButton, "click", async () => {
        if (!existingMedia.selection) return;
        existingAddButton.disabled = true;
        const data = new FormData();
        data.set("csrfmiddlewaretoken", form.elements.namedItem("csrfmiddlewaretoken").value);
        data.set("kind", existingKind.value);
        data.set("media_id", existingMedia.selection.value);
        try {
          const response = await fetch(form.dataset.mediaExistingUrl, { method: "POST", body: data });
          const payload = await response.json();
          if (!response.ok) {
            window.alert(`Add failed: ${JSON.stringify(payload.errors || payload)}`);
            return;
          }
          applyMediaResponse(mediaUpdates, payload);
          closeExisting();
        } catch (error) {
          window.alert("Add failed.");
        } finally {
          existingAddButton.disabled = !existingMedia.selection;
        }
      }),
    ];

    return () => {
      cleanups.forEach((cleanup) => cleanup());
      mediaUpdates.unobserve(syncRemoteMedia);
      existingMedia.destroy();
      mediaTags.destroy();
      mediaAuthors.destroy();
    };
  }, [form, mediaUpdates]);
}
