import { useEffect } from "react";
import { createRoot } from "react-dom/client";

const focusableSelector = "input:not([type='hidden']), select, textarea, button";

function on(target, eventName, callback, options) {
  target.addEventListener(eventName, callback, options);
  return () => target.removeEventListener(eventName, callback, options);
}

function setModalOpen(modal, isOpen, focusTarget = null) {
  modal.hidden = !isOpen;
  document.body.classList.toggle(
    "article-media-modal-open",
    Boolean(document.querySelector(".article-media-modal:not([hidden])")),
  );

  if (isOpen) {
    window.requestAnimationFrame(() => {
      (focusTarget || modal.querySelector(focusableSelector)).focus();
    });
  }
}

function usePageFieldToggles(form, schedulePreview) {
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
        on(field, "input", syncToggle),
        on(toggle, "change", onToggleChange),
      ];
    });

    return () => cleanups.forEach((cleanup) => cleanup());
  }, [form, schedulePreview]);
}

function useArticleAuthorsPanel() {
  useEffect(() => {
    const panel = document.querySelector("[data-article-authors-panel]");
    if (!panel) return undefined;

    const rows = panel.querySelector("[data-article-author-rows]");
    const form = panel.closest("form");
    const notifyChanged = () => {
      form.dispatchEvent(new Event("input", { bubbles: true }));
    };

    const cleanups = [
      on(panel, "click", (event) => {
        const addButton = event.target.closest("[data-article-author-add]");
        const removeButton = event.target.closest("[data-article-author-remove]");
        if (!addButton && !removeButton) return;

        event.preventDefault();

        if (addButton) {
          const row = rows.querySelector("[data-article-author-row]").cloneNode(true);
          row.querySelectorAll("select").forEach((select) => { select.selectedIndex = 0; });
          rows.appendChild(row);
          window.requestAnimationFrame(() => {
            row.querySelector("[data-article-author-select]").focus();
          });
        } else {
          const row = removeButton.closest("[data-article-author-row]");
          const allRows = rows.querySelectorAll("[data-article-author-row]");
          if (allRows.length === 1) row.querySelectorAll("select").forEach((select) => { select.selectedIndex = 0; });
          else row.remove();
        }

        notifyChanged();
      }),
      on(panel, "change", notifyChanged),
    ];

    return () => cleanups.forEach((cleanup) => cleanup());
  }, []);
}

function useMetadataTabs() {
  useEffect(() => {
    const cleanups = Array.from(document.querySelectorAll("[data-metadata-tab]")).map((tab) => (
      on(tab, "click", () => {
        document.querySelectorAll("[data-metadata-tab]").forEach((item) => {
          item.setAttribute("aria-selected", String(item.dataset.metadataTab === tab.dataset.metadataTab));
        });
        document.querySelectorAll("[data-metadata-panel]").forEach((panel) => {
          panel.hidden = panel.dataset.metadataPanel !== tab.dataset.metadataTab;
        });
      })
    ));
    return () => cleanups.forEach((cleanup) => cleanup());
  }, []);
}

function useMediaAndSettingsModals(form) {
  useEffect(() => {
    const uploadButton = document.querySelector("[data-article-media-upload-button]");
    const settingsModal = document.querySelector("[data-manuscript-settings-modal]");
    const uploadModal = document.querySelector("[data-article-media-upload-modal]");
    const galleryModal = document.querySelector("[data-article-media-gallery-modal]");
    const uploadTitle = document.querySelector("[data-article-media-upload-title]");
    const kind = form.elements.namedItem("article_media-kind");
    let uploadReturnsToGallery = false;

    const mediaField = (name) => form.querySelector(`#id_article_media-${name}`);
    const setUploadMode = (mode) => {
      const editing = mode === "edit";
      uploadTitle.textContent = editing ? "Edit media" : "Upload media";
      uploadButton.textContent = editing ? "Save" : "Upload";
    };
    const reset = () => {
      form.querySelectorAll("[name^='article_media-']").forEach((field) => {
        if (field !== kind) field.value = "";
      });
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
      uploadModal.classList.remove("article-media-modal--stacked");
      uploadReturnsToGallery = false;
      reset();
      syncImageFields();
      if (shouldFocusGallery) {
        window.requestAnimationFrame(() => {
          galleryModal.querySelector("[data-article-media-edit-button], a, button").focus();
        });
      }
    };

    syncImageFields();

    const cleanups = [
      on(document.querySelector("[data-manuscript-open-settings]"), "click", () => {
        setModalOpen(settingsModal, true, settingsModal.querySelector(focusableSelector));
      }),
      on(document.querySelector("[data-article-media-open-upload]"), "click", () => {
        uploadReturnsToGallery = !galleryModal.hidden;
        uploadModal.classList.toggle("article-media-modal--stacked", uploadReturnsToGallery);
        reset();
        syncImageFields();
        setModalOpen(uploadModal, true, kind);
      }),
      on(document.querySelector("[data-article-media-open-gallery]"), "click", () => {
        setModalOpen(galleryModal, true, galleryModal.querySelector("[data-article-media-edit-button], a, button"));
      }),
      on(form, "click", (event) => {
        const editButton = event.target.closest("[data-article-media-edit-button]");
        if (!editButton) return;

        const card = editButton.closest("[data-article-media-item]");
        event.preventDefault();

        ["id", "kind", "title", "author", "description", "tags"].forEach((name) => {
          const field = mediaField(name === "id" ? "media_id" : name);
          field.value = card.dataset[name] || "";
        });
        mediaField("file").value = "";
        form.dataset.articleMediaEditKind = card.dataset.kind;
        setUploadMode("edit");
        syncImageFields();
        uploadReturnsToGallery = !galleryModal.hidden;
        uploadModal.classList.toggle("article-media-modal--stacked", uploadReturnsToGallery);
        setModalOpen(uploadModal, true, mediaField("title"));
      }),
      ...Array.from(document.querySelectorAll("[data-article-media-close], [data-manuscript-settings-close]")).map((button) => (
        on(button, "click", () => {
          const modal = button.closest("[data-manuscript-settings-modal], [data-article-media-upload-modal], [data-article-media-gallery-modal]");
          if (modal === uploadModal) closeUpload();
          else setModalOpen(modal, false);
        })
      )),
      on(document, "keydown", (event) => {
        if (event.key !== "Escape") return;
        if (!uploadModal.hidden) closeUpload();
        else if (!galleryModal.hidden) setModalOpen(galleryModal, false);
        else if (!settingsModal.hidden) setModalOpen(settingsModal, false);
      }),
      on(kind, "change", syncImageFields),
      on(uploadButton, "click", async () => {
        uploadButton.disabled = true;
        try {
          const response = await fetch(form.dataset.mediaUploadUrl, { method: "POST", body: new FormData(form) });
          const payload = await response.json();
          if (!response.ok) {
            window.alert(`Upload failed: ${JSON.stringify(payload.errors || payload)}`);
            return;
          }

          document.querySelector("[data-article-media-gallery]").outerHTML = payload.gallery;
          const selector = `.pm-control-field--${payload.item.kind} select${payload.item.kind === "image" ? ",select[name='featured_media-image']" : ""}`;
          document.querySelectorAll(selector).forEach((select) => {
            const existingOption = Array.from(select.options).find((item) => String(item.value) === String(payload.item.id));
            const option = existingOption || select.appendChild(new Option());
            option.value = payload.item.id;
            option.textContent = payload.item.title;
          });

          closeUpload();
        } catch (error) {
          window.alert("Upload failed.");
        } finally {
          uploadButton.disabled = false;
        }
      }),
    ];
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [form]);
}

function useAsyncSave(form, writeBeforeSave) {
  useEffect(() => {
    const cleanup = on(form, "submit", async (event) => {
      event.preventDefault();

      const submitter = event.submitter;
      const originalText = submitter.textContent;
      const saveButtons = form.querySelectorAll("[data-article-action]");

      writeBeforeSave();
      const formData = new FormData(form);
      formData.set(submitter.name, submitter.value);

      saveButtons.forEach((button) => { button.disabled = true; });
      submitter.textContent = "Saving...";

      try {
        const response = await fetch(form.getAttribute("action"), {
          method: "POST",
          body: formData,
          credentials: "same-origin",
          headers: {
            Accept: "application/json",
            "X-Requested-With": "XMLHttpRequest",
          },
        });
        const payload = (response.headers.get("content-type") || "").includes("application/json")
          ? await response.json()
          : {};

        if (!response.ok || payload.errors) {
          const message = payload.errors
            ? Object.entries(payload.errors)
              .map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(", ") : messages}`)
              .join("\n")
            : `Save failed with status ${response.status}: ${form.getAttribute("action")}`;
          window.alert(message);
          return;
        }

        const historySelect = document.querySelector("[data-history-select]");
        if (historySelect && payload.revision) {
          const revisionId = String(payload.revision.id);
          const existingOption = Array.from(historySelect.options).find((option) => option.value === revisionId);
          if (!existingOption) {
            const option = document.createElement("option");
            option.value = revisionId;
            option.textContent = payload.revision.label || `Revision ${revisionId}`;
            historySelect.insertBefore(option, historySelect.options[0]);
          }
          historySelect.selectedIndex = 0;
        }

        submitter.textContent = payload.action === "publish" ? "Published" : "Saved";
        window.setTimeout(() => { submitter.textContent = originalText; }, 1400);
      } catch (error) {
        console.error(error);
        window.alert("Failed to save.");
      } finally {
        saveButtons.forEach((button) => { button.disabled = false; });
        if (submitter.textContent === "Saving...") submitter.textContent = originalText;
      }
    });

    return cleanup;
  }, [form, writeBeforeSave]);
}

function ManuscriptChrome({ form, schedulePreview, writeBeforeSave }) {
  usePageFieldToggles(form, schedulePreview);
  useArticleAuthorsPanel();
  useMetadataTabs();
  useMediaAndSettingsModals(form);
  useAsyncSave(form, writeBeforeSave);

  return null;
}

export function mountManuscriptChrome(props) {
  const mount = document.createElement("div");
  mount.hidden = true;
  mount.dataset.manuscriptChromeRoot = "";
  document.body.appendChild(mount);
  createRoot(mount).render(<ManuscriptChrome {...props} />);
}
