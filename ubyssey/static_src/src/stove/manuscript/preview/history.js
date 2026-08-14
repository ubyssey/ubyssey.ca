import { syncSelectedArticleBlockEditor } from "../blocks/controller.jsx";
import { manuscriptSession } from "../session.js";
import { writeStreamTextareas } from "./persistence.js";
import { replaceArticlePreviewHtml, restoreCurrentArticleControls } from "./html.js";
import { fetchPreviewHtml } from "./requests.js";

// Lazy loading Revision History
async function loadRevisionHistory(form, historySelect) {
  if (!form.dataset.historyUrl || !historySelect) return;

  try {
    const response = await fetch(form.dataset.historyUrl, {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(`History request failed status ${response.status}`);
    }

    // Current draft option in revision dropdown
    const currentOption = document.createElement("option");
    currentOption.value = "";
    currentOption.textContent = "Current draft";

    const options = (payload.revisions || []).map((revision) => {
      const option = document.createElement("option");
      option.value = revision.id;
      option.textContent = revision.label;
      return option;
    });

    historySelect.replaceChildren(currentOption, ...options);
    historySelect.disabled = false;
  } catch (error) {
    console.error(error);
    historySelect.options[0].textContent = "Failed to fetch history";
  }
}

export function setupHistoryPreviewButtons(manuscriptRoot) {
  const form = document.querySelector("[data-manuscript-form]");
  const historyButtons = document.querySelectorAll("[data-history-button]");
  const historySelect = document.querySelector("[data-history-select]");
  const restoreButton = document.querySelector("[data-history-restore]");
  const returnButton = document.querySelector("[data-history-return]");
  if (!form || !manuscriptRoot) return;
  let historyPreviewId = 0;
  loadRevisionHistory(form, historySelect);

  const selectedRevision = () => historySelect?.value || "";
  const selectedRevisionIsCurrent = () => !historySelect || historySelect.value === "";
  const updateHistoryMode = () => {
    form.classList.toggle("manuscript-editor--history", !selectedRevisionIsCurrent());
    if (restoreButton) restoreButton.disabled = selectedRevisionIsCurrent();
  };

  const previewRevision = async (revisionId, isCurrent = false) => {
    const currentPreviewId = ++historyPreviewId;
    try {
      manuscriptSession.cancelPreviewRefresh();
      const formData = new FormData(form);
      const streamDocs = isCurrent ? writeStreamTextareas() : null;

      if (!isCurrent) formData.set("revision", revisionId);

      const html = await fetchPreviewHtml(form, formData);
      if (currentPreviewId !== historyPreviewId || !html || !replaceArticlePreviewHtml(manuscriptRoot, html)) return;

      if (isCurrent) {
        restoreCurrentArticleControls(manuscriptRoot, streamDocs);
      } else {
        manuscriptSession.selectedArticleBlock = null;
        syncSelectedArticleBlockEditor(null);
      }
    } catch (error) {
      if (error.name !== "AbortError") console.error(error);
    }
  };

  historySelect?.addEventListener("change", (event) => {
    event.stopPropagation();
    updateHistoryMode();
    previewRevision(historySelect.value, selectedRevisionIsCurrent());
  });

  returnButton?.addEventListener("click", () => {
    historySelect.selectedIndex = 0;
    historySelect.dispatchEvent(new Event("change", { bubbles: true }));
  });

  restoreButton?.addEventListener("click", async () => {
    const revisionId = selectedRevision();
    if (!form.dataset.restoreUrl || selectedRevisionIsCurrent()) return;
    if (!window.confirm("Restore this version as the current draft?")) return;
    
    const originalText = restoreButton.textContent;
    restoreButton.disabled = true;
    restoreButton.textContent = "Restoring...";
    try {
      writeStreamTextareas();
      const formData = new FormData(form);
      formData.set("revision", revisionId);
      const response = await fetch(form.dataset.restoreUrl, {
        method: "POST",
        body: formData,
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
      });
      const payload = await response.json();
      if (!response.ok || payload.errors) {
        const message = payload.errors
          ? Object.entries(payload.errors)
            .map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(", ") : messages}`)
            .join("\n")
          : "Failed to restore version.";
        alert(message);
        return;
      }
      window.location.reload();
    } catch (error) {
      console.error(error);
      alert("Failed to restore version.");
    } finally {
      restoreButton.textContent = originalText;
      updateHistoryMode();
    }
  });

  updateHistoryMode();

  for (const btn of historyButtons) {
    btn.addEventListener("click", () => { previewRevision(btn.dataset.revisionId); });
  }
}
