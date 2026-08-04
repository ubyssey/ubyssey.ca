// in it's own file cause it's used in multiple preview files

// POSTS new form data to server and returns the new preview html

export async function fetchPreviewHtml(form, formData, signal = null) {
  const response = await fetch(form.dataset.previewUrl, {
    method: "POST",
    body: formData,
    credentials: "same-origin",
    signal,
  });
  const payload = await response.json();
  return response.ok && payload.html ? payload.html : null;
}
