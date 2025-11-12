// ===============================
// 📁 MPulse Collapsible Media Viewer
// Version: 2025.10.22
// Author: Daniel O. / GPT-5
// ===============================

(async () => {
  console.log("📁 MPulse Collapsible Media Viewer loaded");

  const containerId = "customMediaList";

  // --- Utility: build collapsible list ---
  function buildCustomMediaList(media) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";

    if (!media?.length) {
      container.innerHTML = "<p style='color:#888'>No media attachments found.</p>";
      return;
    }

    // Group by category
    const groups = { Images: [], Documents: [], Others: [] };
    media.forEach(m => {
      const type = (m?.type || "").toLowerCase();
      const desc = m?.desc || "(Unnamed)";
      const path = m?.path || "#";
      const item = { desc, path, type };
      if (["jpg","jpeg","png","gif","bmp","tif","tiff"].includes(type)) groups.Images.push(item);
      else if (["pdf","doc","docx","xls","xlsx","csv","txt","rtf","ppt","pptx"].includes(type)) groups.Documents.push(item);
      else groups.Others.push(item);
    });

    const buildSection = (title, items, previewable) => `
      <div class="media-section">
        <div class="media-header">${title} (${items.length})</div>
        <div class="media-body">
          ${items.map(i => `
            <div class="media-item" data-type="${i.type}">
              <span>${i.desc} <small style="color:#777">(${i.type.toUpperCase()})</small></span>
              <a href="${i.path}" target="_blank">Open</a>
              ${previewable ? `<div class="media-preview"><img src="${i.path}" alt="${i.desc}"></div>` : ""}
            </div>`).join("")}
        </div>
      </div>`;

    container.innerHTML = `
      ${buildSection("Images", groups.Images, true)}
      ${buildSection("Documents", groups.Documents, false)}
      ${buildSection("Other Files", groups.Others, false)}
    `;

    // Accordion toggles
    container.querySelectorAll(".media-header").forEach(header => {
      header.onclick = () => {
        const body = header.nextElementSibling;
        const open = body.style.display === "block";
        container.querySelectorAll(".media-body").forEach(b => (b.style.display = "none"));
        body.style.display = open ? "none" : "block";
      };
    });

    // Inline image previews
    container.querySelectorAll(".media-item[data-type]").forEach(item => {
      const type = item.dataset.type;
      if (["jpg","jpeg","png","gif","bmp","tif","tiff"].includes(type)) {
        const preview = item.querySelector(".media-preview");
        const label = item.querySelector("span");
        label.style.cursor = "pointer";
        label.onclick = () => {
          const visible = preview.style.display === "block";
          container.querySelectorAll(".media-preview").forEach(p => (p.style.display = "none"));
          preview.style.display = visible ? "none" : "block";
        };
      }
    });
  }

  // --- Utility: inject styles if not already present ---
  function injectStyles() {
    if (document.getElementById("customMediaStyle")) return;
    const css = `
      #${containerId} { margin-top:10px; }
      .media-section {
        margin-bottom:10px; border:1px solid #ccc; border-radius:6px; background:#f9f9f9;
      }
      .media-header {
        background:#f3f3f3; padding:8px 10px; font-weight:600; cursor:pointer;
        border-radius:6px 6px 0 0; transition:background 0.2s ease;
      }
      .media-header:hover { background:#e9e9e9; }
      .media-body { display:none; padding:6px 10px; background:#fff; }
      .media-item {
        border-bottom:1px solid #eee; padding:6px 0;
        display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap;
      }
      .media-item span { font-size:13px; color:#333; flex:1; }
      .media-item a { font-size:12px; color:#0078d4; text-decoration:none; }
      .media-preview { display:none; width:100%; text-align:center; margin-top:8px; }
      .media-preview img {
        max-width:95%; max-height:400px; border:1px solid #ccc; border-radius:6px;
        box-shadow:0 0 4px rgba(0,0,0,0.2);
      }
    `;
    const style = document.createElement("style");
    style.id = "customMediaStyle";
    style.innerText = css;
    document.head.appendChild(style);
  }

  // --- Wait for MPulse media to load dynamically ---
  function watchForMedia() {
    const observer = new MutationObserver(() => {
      const el = document.querySelector('[ng-repeat="mediadetails in media"]');
      if (el && angular.element(el).scope()?.media?.length) {
        const media = angular.element(el).scope().media;
        injectStyles();
        if (!document.getElementById(containerId)) {
          const div = document.createElement("div");
          div.id = containerId;
          document.querySelector(".mobile-media-content-area")?.before(div);
        }
        buildCustomMediaList(media);
        const native = document.querySelector(".mobile-media-content-area");
        if (native) native.style.display = "none";
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  watchForMedia();
})();
