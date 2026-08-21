
// Adds media to gallery on response
export function applyMediaResponse(mediaUpdates, payload, publish = true) {
  document.querySelector("[data-article-media-gallery]").outerHTML = payload.gallery;
  const selector = ".pm-control-field--" + payload.item.kind + " select" + (payload.item.kind === "image" ? ",select[name='featured_media-image']" : "");

  document.querySelectorAll(selector).forEach((select) => {
    const existingOption = Array.from(select.options).find((item) => String(item.value) === String(payload.item.id));
    const option = existingOption || select.appendChild(new Option());
    option.value = payload.item.id;
    option.textContent = payload.item.title;
  });

  if (publish) {
    mediaUpdates.doc.transact(() => {
      mediaUpdates.set("latest", { ...payload, revision: Date.now() });
    }, "article-media");
  }
}
