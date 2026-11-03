// Topbar save status indicator

function formatSavedAt(date) {
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function showRecoveryData(savedStatus, recovery) {
  if (!recovery) return;

  const recoveryJson = JSON.stringify({ format: recovery.format, update: recovery.update }, null, 2);
  const message = document.createElement("span");
  message.textContent = "Failed to save for some reason, download your data here (also let us know cause this shouldn't happen) ";

  const copy = document.createElement("button");
  copy.type = "button";
  copy.textContent = "Copy recovery data";
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(recoveryJson);
      copy.textContent = "Recovery data copied";
    } catch (_error) {
      window.prompt("Copy recovery data", recoveryJson);
    }
  });

  const download = document.createElement("button");
  download.type = "button";
  download.textContent = "Download recovery data";
  download.addEventListener("click", () => {
    const url = URL.createObjectURL(new Blob([recoveryJson], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "stove-article-recovery.json";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url));
  });

  const discard = document.createElement("button");
  discard.type = "button";
  discard.textContent = "Discard recovery data";
  discard.addEventListener("click", () => {
    if (!window.confirm("Discard this recovery data? This cannot be undone.")) return;
    window.localStorage.removeItem(recovery.key);
    message.remove();
  });

  message.append(
    copy,
    document.createTextNode(" or "),
    download,
    document.createTextNode(" or "),
    discard,
  );
  savedStatus.insertAdjacentElement("afterend", message);
}

export function setupPageSaveStatus(collaboration, onChange = () => {}) {
  const savedStatus = document.querySelector("[data-page-saved]");
  let saveFailed = false;

  showRecoveryData(savedStatus, collaboration.recovery);

  const updateSavingStatus = (_update, origin) => {
    if (origin === collaboration.provider) return;
    savedStatus.textContent = "Saving...";
    onChange();
  };

  const updateSavedStatus = () => {
    if (saveFailed) return;
    const savedAt = new Date();
    savedStatus.dataset.lastSavedAt = savedAt.toISOString();
    savedStatus.textContent = "Saved: " + formatSavedAt(savedAt);
    onChange();
  };

  const saveFailedHandler = () => {
    saveFailed = true;
    savedStatus.textContent = "Failed to save. Undo your last change, contact webmaster if this isn't resolved.";
    onChange();
  };

  const saveInterruptedHandler = () => {
    savedStatus.textContent = "Save interrupted. Reconnecting...";
    onChange();
  };


  document.addEventListener("editor-save-failed", saveFailedHandler);
  collaboration.ydoc.on("update", updateSavingStatus);
  // The server sends this only to the connection whose updates were merged
  collaboration.provider?.on("persistence-ack", () => {
    saveFailed = false;
    updateSavedStatus();
  });
  collaboration.provider?.on("persistence-error", saveInterruptedHandler);
}
