// Preview HTML fetcher helper

export async function fetchPreviewHtml(url, formData, signal = null) {
  const response = await fetch(url, {
    method: "POST",
    body: formData,
    credentials: "same-origin",
    signal,
  });
  const payload = await response.json();

  if (!formData.get("revision") && !response.ok && !payload.syncing) {
    document.dispatchEvent(new Event("editor-save-failed"));
  }

  return {
    html: response.ok && payload.html ? payload.html : null,
    syncing: Boolean(payload.syncing),
  };
}
