(async function () {

  /* ================= CLEANUP ================= */
  document.getElementById("mpulseTagHoverPanel")?.remove();
  window.__mpulseTagPickerCleanup?.();

  /* ================= INVENTORY PAGE GUARD ================= */
  function isInventoryRecordPage() {
    return !!document.querySelector(
      'textarea[fieldname="CustomFields.OBJ_840"]'
    );
  }

  if (!isInventoryRecordPage()) {
    console.log("ℹ Applicability picker suppressed (not Inventory record)");
    return;
  }

  /* ================= CONFIG ================= */
  const FIELD_MODEL = "CustomFields.OBJ_840";

  // 🔴 EDIT THIS PATH ONLY
  const TAG_CONFIG_URL =
    "https://raw.githubusercontent.com/dolivarez/mpulse-scripts/main/inventoryTags.json";

  /* ================= FALLBACK CONFIG ================= */
  const FALLBACK_TAG_CONFIG = {
    Cyclotron: {
      PETtrace800: {
        label: "GE PETtrace 800",
        subsystems: ["Ion Source"]
      }
    }
  };

  /* ================= NORMALIZATION ================= */
  function normalizeLine(str) {
    return str
      .replace(/[–—]/g, "-")
      .replace(/\s*-\s*/g, " - ")
      .replace(/\s+/g, " ")
      .trim();
  }

  /* ================= CKEDITOR HELPERS ================= */
  function findEditor() {
    return Object.values(CKEDITOR.instances || {})
      .find(e => e.element?.getAttribute("fieldname") === FIELD_MODEL);
  }

  function lockEditor(ed) {
    if (!ed) return;
    ed.on("instanceReady", () => ed.setReadOnly(true));
    ed.setReadOnly(true);
  }

  let editor = findEditor();
  if (!editor) {
    console.error("❌ CKEditor field not found:", FIELD_MODEL);
    return;
  }

  lockEditor(editor);

  /* ================= LOAD TAG CONFIG ================= */
  async function loadTagConfig() {
    const res = await fetch(TAG_CONFIG_URL, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return await res.json();
  }

  let TAG_CONFIG;
  let TAG_VERSION = "";

  try {
    const configData = await loadTagConfig();
    TAG_CONFIG = configData.tags;        // ✅ IMPORTANT
    TAG_VERSION = configData.version || "";
    console.log(`✔ Loaded tag config v${TAG_VERSION}`);
  } catch (err) {
    console.warn("⚠ Failed to load tag config, using fallback:", err.message);
    TAG_CONFIG = FALLBACK_TAG_CONFIG;
  }

  /* ================= STATE ================= */
  let selections = new Set();
  let lastEditorData = "";

  /* ================= PARSE CKEDITOR ================= */
  function loadFromEditor() {
    selections.clear();

    const raw = editor.getData() || "";

    raw
      .replace(/<\/p>\s*<p>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/?p[^>]*>/gi, "")
      .split("\n")
      .map(v => normalizeLine(v))
      .filter(Boolean)
      .forEach(v => selections.add(v));

    lastEditorData = editor.getData();
    syncUI();
  }

  /* ================= WRITE CKEDITOR ================= */
  function writeEditor() {
    const html = [...selections]
      .map(v => `<p>${v}</p>`)
      .join("");

    editor.setData(html);
    editor.updateElement();
    lastEditorData = editor.getData();
  }

  /* ================= PANEL ================= */
  const panel = document.createElement("div");
  panel.id = "mpulseTagHoverPanel";
  panel.innerHTML = `
    <div class="handle">
      Applicability${TAG_VERSION ? ` (v${TAG_VERSION})` : ""}
    </div>
    <div class="content">
      <div style="display:flex; gap:6px; margin-bottom:6px">
        <input id="tagSearch" placeholder="Search…" style="flex:1" />
        <button id="clearTags" title="Clear all">✕</button>
      </div>
      <div id="tagPickerUI"></div>
    </div>
  `;
  document.body.appendChild(panel);

  /* ================= STYLES ================= */
  const style = document.createElement("style");
  style.innerHTML = `
    #mpulseTagHoverPanel {
      position: fixed;
      right: 14px;
      bottom: 18px;
      width: 150px;
      height: 34px;
      background: #0078d4;
      color: white;
      z-index: 9999;
      border-radius: 6px;
      font-family: Segoe UI, Arial, sans-serif;
      transition: all 0.25s ease;
      overflow: hidden;
      box-shadow: 0 4px 10px rgba(0,0,0,0.25);
    }
    #mpulseTagHoverPanel:hover {
      width: 460px;
      height: 460px;
    }
    #mpulseTagHoverPanel .handle {
      text-align: center;
      line-height: 34px;
      font-weight: 600;
      cursor: pointer;
    }
    #mpulseTagHoverPanel .content {
      display: none;
      background: #f9fbfd;
      color: #000;
      padding: 8px;
      height: calc(100% - 34px);
      overflow-y: auto;
    }
    #mpulseTagHoverPanel:hover .content {
      display: block;
    }
    .section-title {
      font-weight: 700;
      cursor: pointer;
      margin: 6px 0;
    }
    .model-title {
      font-weight: 600;
      margin: 4px 0;
      cursor: pointer;
    }
    .collapsed > .children {
      display: none;
    }
    .tag {
      display: inline-block;
      padding: 5px 9px;
      margin: 3px;
      border-radius: 14px;
      border: 1px solid #888;
      cursor: pointer;
      font-size: 12px;
      background: white;
    }
    .tag.selected {
      background: #0078d4;
      color: white;
      border-color: #0078d4;
    }
  `;
  document.head.appendChild(style);

  /* ================= RENDER ================= */
  const ui = panel.querySelector("#tagPickerUI");
  const tagEls = [];

  Object.entries(TAG_CONFIG).forEach(([equipClass, models]) => {
    const classBlock = document.createElement("div");

    const classTitle = document.createElement("div");
    classTitle.className = "section-title";
    classTitle.textContent = equipClass;
    classTitle.onclick = () => classBlock.classList.toggle("collapsed");
    classBlock.appendChild(classTitle);

    const classChildren = document.createElement("div");
    classChildren.className = "children";

    Object.values(models).forEach(model => {
      const modelBlock = document.createElement("div");

      const modelTitle = document.createElement("div");
      modelTitle.className = "model-title";
      modelTitle.textContent = model.label;
      modelTitle.onclick = () => modelBlock.classList.toggle("collapsed");
      modelBlock.appendChild(modelTitle);

      const modelChildren = document.createElement("div");
      modelChildren.className = "children";

      (model.subsystems || []).forEach(sub => {
        const line = normalizeLine(`${equipClass} - ${model.label} - ${sub}`);
        const tag = document.createElement("span");
        tag.className = "tag";
        tag.textContent = sub;
        tag.dataset.line = line;

        tag.onclick = () => {
          if (selections.has(line)) {
            selections.delete(line);
            tag.classList.remove("selected");
          } else {
            selections.add(line);
            tag.classList.add("selected");
          }
          writeEditor();
        };

        tagEls.push(tag);
        modelChildren.appendChild(tag);
      });

      modelBlock.appendChild(modelChildren);
      classChildren.appendChild(modelBlock);
    });

    classBlock.appendChild(classChildren);
    ui.appendChild(classBlock);
  });

  function syncUI() {
    tagEls.forEach(t =>
      t.classList.toggle("selected", selections.has(t.dataset.line))
    );
  }

  /* ================= SEARCH ================= */
  panel.querySelector("#tagSearch").addEventListener("input", e => {
    const q = e.target.value.toLowerCase();
    tagEls.forEach(t => {
      t.style.display = t.dataset.line.toLowerCase().includes(q) ? "" : "none";
    });
  });

  /* ================= CLEAR ALL ================= */
  panel.querySelector("#clearTags").onclick = () => {
    selections.clear();
    writeEditor();
    syncUI();
  };

  /* ================= RECORD CHANGE WATCH ================= */
  const interval = setInterval(() => {
    if (!isInventoryRecordPage()) {
      panel.remove();
      return;
    }

    const newEditor = findEditor();

    if (newEditor && newEditor !== editor) {
      editor = newEditor;
      lockEditor(editor);
      loadFromEditor();
      return;
    }

    if (editor && editor.getData() !== lastEditorData) {
      loadFromEditor();
    }
  }, 750);

  window.__mpulseTagPickerCleanup = () => clearInterval(interval);

  /* ================= INIT ================= */
  loadFromEditor();

  console.log("✅ Tag Picker v1.3.2 loaded (GitHub config, Inventory-only)");

})();
