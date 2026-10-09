// Mounts manuscript specific controls

import { useEffect } from "react";
import { createRoot } from "react-dom/client";

import { useAuthorsPanel } from "../metadata/author_panel.jsx";
import { setupMetadataCollaboration } from "../metadata/collaboration.js";
import { useMediaModals } from "../media/media_modals.jsx";
import { useCopyEditingToggles, usePageFieldToggles } from "./page_fields.js";
import { setupFeaturedMediaSidebarEditors } from "../../core/preview/editables.jsx";

function ManuscriptChrome({ form, metadata, mediaUpdates, onMetadataReady, schedulePreview }) {
  usePageFieldToggles(form, schedulePreview);
  useCopyEditingToggles();
  useAuthorsPanel();
  useEffect(() => {
    const cleanup = setupMetadataCollaboration(form, metadata);
    // Waits till collab metadata applied to form before initial refresh
    onMetadataReady?.();
    return cleanup;
  }, [form, metadata, onMetadataReady]);
  useEffect(() => setupFeaturedMediaSidebarEditors(form), [form]);
  useMediaModals(form, mediaUpdates);

  return null;
}

export function mountManuscriptChrome(props) {
  const mount = document.createElement("div");
  mount.hidden = true;
  mount.dataset.manuscriptChromeRoot = "";
  document.body.appendChild(mount);
  createRoot(mount).render(<ManuscriptChrome {...props} />);
}
