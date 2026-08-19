// To use article JS and CSS in the preview without affecting the actual editor, we use Shadow DOM
// see https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM

const theme = "light" // todo Add setting in future

export function setupArticleShadow() {
  const host = document.querySelector("[data-article-shadow]");
  if (!host) {
    return null;
  }

  const articleStylesheets = Array.from(host.querySelectorAll("[data-article-stylesheet]"));
  const articleStylesheetHrefs = articleStylesheets.map((stylesheet) => stylesheet.getAttribute("href")).filter(Boolean);

  for (const stylesheet of articleStylesheets) {
    stylesheet.remove();
  }

  const articleHtml = host.innerHTML;
  host.innerHTML = "";

  const shadowRoot = host.shadowRoot || host.attachShadow({ mode: "open" });
  shadowRoot.innerHTML = "";

  const stylesheets = [
    host.dataset.typekitCss,
    host.dataset.bootstrapCss,
    ...articleStylesheetHrefs,
    host.dataset.shadowEditorCss,
  ].filter(Boolean);

  for (const href of stylesheets) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    shadowRoot.appendChild(link);
  }

  const shadowHtml = document.createElement("html");
  const shadowBody = document.createElement("body");

  const updateShadowTheme = () => {
    shadowHtml.setAttribute("color-css-theme", document.documentElement.getAttribute("color-css-theme") || theme);
  };

  updateShadowTheme();
  new MutationObserver(updateShadowTheme).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["color-css-theme"],
  });

  shadowHtml.appendChild(shadowBody);
  shadowRoot.appendChild(shadowHtml);

  for (const style of document.querySelectorAll("style")) {
    if (style.textContent?.includes("ProseMirror")) {
      shadowRoot.appendChild(style.cloneNode(true));
    }
  }

  const toolbar = document.createElement("div");
  toolbar.className = "pm-manuscript-toolbar";
  shadowBody.appendChild(toolbar);

  const wrapper = document.createElement("main");
  const content = document.createElement("div");
  wrapper.className = "article-shadow-preview article";
  content.dataset.articlePreviewContent = "";
  content.innerHTML = articleHtml;
  wrapper.appendChild(content);
  shadowBody.appendChild(wrapper);

  return shadowRoot;
}
