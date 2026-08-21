// Mounts manuscript specific controls

import { useEffect } from "react";
import { createRoot } from "react-dom/client";

import { useAuthorsPanel } from "../metadata/author_panel.jsx";
import { setupMetadataCollaboration } from "../metadata/collaboration.js";
import { useMediaModals } from "../media/media_modals.jsx";
import { usePageFieldToggles } from "./page_fields.js";

function ManuscriptChrome({ form, metadata, mediaUpdates, schedulePreview }) {
  usePageFieldToggles(form, schedulePreview);
  useAuthorsPanel();
  useEffect(() => setupMetadataCollaboration(form, metadata), [form, metadata]);
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
