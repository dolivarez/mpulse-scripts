(async function() {

    /* ================= CLEANUP ================= */
    document.getElementById("mpulseTagHoverPanel")?.remove();
    window.__mpulseTagPickerCleanup?.();

    /* ================= INVENTORY PAGE GUARD ================= */
    function isInventoryRecordPage() {
        return !!document.querySelector('textarea[fieldname="CustomFields.OBJ_840"]');
    }

    if (!isInventoryRecordPage()) {
        console.log("ℹ Applicability picker suppressed (not Inventory record)");
        return;
    }

    /* ================= CONFIG ================= */
    const FIELD_MODEL = "CustomFields.OBJ_840";

    // 🔴 EDIT THIS PATH ONLY
    const TAG_CONFIG_URL = "https://raw.githubusercontent.com/dolivarez/mpulse-scripts/refs/heads/main/inventoryTags.js";
    

    /* ================= FALLBACK CONFIG ================= */
    const FALLBACK_TAG_CONFIG = {
        "Location": {
            "CA1": {
                label: "CA1",
                subsystems: ["General"]
            },
            "IL1": {
                label: "IL1",
                subsystems: ["General"]
            },
            "IL2": {
                label: "IL2",
                subsystems: ["General"]
            },
            "FL1": {
                label: "FL1",
                subsystems: ["General"]
            },
            "FL2": {
                label: "FL2",
                subsystems: ["General"]
            },
            "MA1": {
                label: "MA1",
                subsystems: ["General"]
            },
            "MO1": {
                label: "MO1",
                subsystems: ["General"]
            },
            "NJ2": {
                label: "NJ2",
                subsystems: ["General"]
            },
            "NJ3": {
                label: "NJ3",
                subsystems: ["General"]
            },
            "NY1": {
                label: "NY1",
                subsystems: ["General"]
            },
            "OH1": {
                label: "OH1",
                subsystems: ["General"]
            },
            "TX3": {
                label: "TX3",
                subsystems: ["General"]
            },
            "TX4": {
                label: "TX4",
                subsystems: ["General"]
            },
            "VA1": {
                label: "VA1",
                subsystems: ["General"]
            },
            "WV2": {
                label: "WV2",
                subsystems: ["General"]
            },
        },
        "Cyclotron": {
            "PETtrace800": {
                label: "GE PETtrace 800",
                subsystems: ["Controls", "Extraction", "Ion Source", "LTF", "Magnet", "RF", "Vacuum", "Water Cooling", "General"]
            },
            "Cyclone18/9": {
                label: "IBA Cyclone 18/9",
                subsystems: ["Controls", "Extraction", "Ion Source", "LTF", "Magnet", "RF", "Vacuum", "Water Cooling", "General"]
            },
            "TR-19": {
                label: "ACSI TR-19",
                subsystems: ["Controls", "Extraction", "Ion Source", "LTF", "Magnet", "RF", "Vacuum", "Water Cooling", "Helium Cooling", "General"]
            }
        },

        "STS": {
            "STS": {
                label: "STS",
                subsystems: ["General"]
            },
        },

        "Targets": {
            "TS1650": {
                label: "BTI TS1650",
                subsystems: ["General"]
            },
            "TS1700": {
                label: "BTI TS1700",
                subsystems: ["General"]
            },
            "18-88-0024": {
                label: "BTI 18-88-0024",
                subsystems: ["General"]
            },
            "DC70": {
                label: "Stracotek DC70",
                subsystems: ["General"]
            },
            "DC84": {
                label: "Stracotek DC84",
                subsystems: ["General"]
            }
        },

        "BioRX": {
            BioRX: {
                label: "BioRX",
                subsystems: ["General"]
            },
        },

        "Hot Cells": {
            TemaDHC: {
                label: "Tema DHC",
                subsystems: ["General"]
            },
            MIP: {
                label: "Comecer MIP",
                subsystems: ["General"]
            },
            RadiationShieldingDHC: {
                label: "Radiation Shielding DHC",
                subsystems: ["General"]
            },
            Synt2: {
                label: "Tema Synt2",
                subsystems: ["General"]
            },
            SHC: {
                label: "E Solutions SHC",
                subsystems: ["General"]
            },
            BBS2: {
                label: "Comecer BBS2",
                subsystems: ["General"]
            },
            DCE: {
                label: "Von Gahlen DCE",
                subsystems: ["General"]
            },
            AdvancedMMDHC: {
                label: "Advanced M&M DHC",
                subsystems: ["General"]
            },
            AdvancedMMTC: {
                label: "Advanced M&M Tech Cab",
                subsystems: ["General"]
            }
        },

        Radiochemistry: {
            "FASTlab2": {
                label: "GE FASTlab2",
                subsystems: ["General"]
            },
            "AiO": {
                label: "Trasis AiO",
                subsystems: ["General"]
            },
            "mAiO": {
                label: "Trasis mAiO",
                subsystems: ["General"]
            },
            "Synthera+": {
                label: "IBA Synthera+",
                subsystems: ["General"]
            },
            "Synthera_v2": {
                label: "IBA Synthera v2",
                subsystems: ["General"]
            },
        },

        Manipulators: {
            "27489l": {
                label: "Tru-Motion TM27489L",
                subsystems: ["Wrist","Tong","Arm","General"]
            },
            "274810l": {
                label: "Tru-Motion TM274810L",
                subsystems: ["General"]
            },
            "21408l": {
                label: "Tru-Motion TM21408L",
                subsystems: ["General"]
            },
            g: {
                label: "CRL G",
                subsystems: ["General"]
            },
            fm00438: {
                label: "Tru-Motion FM00438",
                subsystems: ["General"]
            }
        },

        Dispensing: {
            "ADDMK3": {
                label: "ADD MK3",
                subsystems: ["General"]
            },
            "ADDMK4": {
                label: "ADD MK4",
                subsystems: ["General"]
            },
            "SD-P-C8": {
                label: "Stracotek SD-P-C8",
                subsystems: ["General"]
            },
            "CyclotopeDispenser": {
                label: "Cyclotope Dispenser",
                subsystems: ["General"]
            },
            "Capper/Decapper": {
                label: "Capper/Decapper",
                subsystems: ["General"]
            },
        },

        "Air Dryer": {
            "DHW13": {
                label: "Hankinson DHW13",
                subsystems: ["General"]
            },
            "HPR15": {
                label: "Hankinson HPR15",
                subsystems: ["General"]
            },
        },

        Pumps: {
            "mb-602": {
                label: "SMB MB-602",
                subsystems: ["General"]
            },
            Diffstack160: {
                label: "Edwards Diffstack 160",
                subsystems: ["General"]
            },
            e2m80: {
                label: "Edwards E2M80",
                subsystems: ["General"]
            },
            e2m40: {
                label: "Edwards E2M40",
                subsystems: ["General"]
            },
            dif320: {
                label: "Pfeiffer DIF320",
                subsystems: ["General"]
            },
            duo20m: {
                label: "Pfeiffer Duo 20M",
                subsystems: ["General"]
            }
        }
    };

    /* ================= NORMALIZATION ================= */
    function normalizeLine(str) {
        return str.replace(/[–—]/g, "-").replace(/\s*-\s*/g, " - ").replace(/\s+/g, " ").trim();
    }

    

    /* ================= CKEDITOR HELPERS ================= */
    function findEditor() {
        return Object.values(CKEDITOR.instances || {}).find(e => e.element?.getAttribute("fieldname") === FIELD_MODEL);
    }

    function lockEditorSafely(fieldName) {
        const wait = setInterval(() => {
            const ed = Object.values(CKEDITOR.instances || {})
                .find(e => e.element?.getAttribute("fieldname") === fieldName);
    
            if (!ed || typeof ed.setReadOnly !== "function") return;
    
            clearInterval(wait);
            ed.setReadOnly(true);
    
            ed.on("instanceReady", () => {
                const fresh = Object.values(CKEDITOR.instances || {})
                    .find(e => e.element?.getAttribute("fieldname") === fieldName);
    
                if (fresh && typeof fresh.setReadOnly === "function") {
                    fresh.setReadOnly(true);
                }
            });
        }, 200);
    }



    function attachApplicabilityButton(onClick) {
      const label = document.querySelector(
        'textarea[fieldname="CustomFields.OBJ_840"]'
      )?.closest("div")?.querySelector("label");
    
      if (!label || label.dataset.applicabilityAttached) return;
    
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = "Applicability";
      btn.style.marginLeft = "8px";
      btn.style.padding = "3px 10px";
      btn.style.fontSize = "12px";
      btn.style.borderRadius = "12px";
      btn.style.border = "1px solid #0078d4";
      btn.style.background = "#fff";
      btn.style.color = "#0078d4";
      btn.style.cursor = "pointer";
    
      btn.onclick = onClick;
    
      label.appendChild(btn);
      label.dataset.applicabilityAttached = "true";
    }


    let editor = null;
    lockEditorSafely(FIELD_MODEL);


    /* ================= LOAD TAG CONFIG ================= */
    async function loadTagConfig() {
        const res = await fetch(TAG_CONFIG_URL, {
            cache: "no-store"
        });
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }
        return await res.json();
    }

    let TAG_CONFIG = FALLBACK_TAG_CONFIG;
    let TAG_VERSION = "fallback";

    try {
        const configData = await loadTagConfig();
        TAG_CONFIG = configData.tags;
        // ✅ IMPORTANT
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
        if (!editor) return;
    
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
        const html = [...selections].map(v => `<p>${v}</p>`).join("");

        editor.setData(html);
        editor.updateElement();
        lastEditorData = editor.getData();
    }






    /* ================= PANEL ================= */
    const panel = document.createElement("div");
    panel.id = "mpulseTagHoverPanel";
    panel.innerHTML = `
      <div class="header">
        Applicability
        <div class="header-actions">
        <button id="expandAll">＋</button>
        <button id="collapseAll">－</button>
      </div>
        <button id="closeApplicability">✕</button>
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

     const closeBtn = panel.querySelector("#closeApplicability");

    closeBtn.onclick = () => panel.classList.remove("open");
    
    // ESC key closes panel
    document.addEventListener("keydown", e => {
      if (e.key === "Escape") panel.classList.remove("open");
    });
    
    // Click outside closes panel
    document.addEventListener("mousedown", e => {
      if (!panel.contains(e.target) && panel.classList.contains("open")) {
        panel.classList.remove("open");
      }
    });

    panel.querySelector("#expandAll").onclick = () => {
      panel.querySelectorAll(".collapsed")
        .forEach(el => el.classList.remove("collapsed"));
    };
    
    panel.querySelector("#collapseAll").onclick = () => {
      panel.querySelectorAll(".section-title, .model-title")
        .forEach(title => title.parentElement.classList.add("collapsed"));
    };

    function positionPanel() {
      const margin = 20;
      panel.style.top = `${margin}px`;
      panel.style.left = `${window.innerWidth - panel.offsetWidth - margin}px`;
    }




   
   


    attachApplicabilityButton(() => {
      const open = panel.classList.toggle("open");
      if (open) positionPanel();
    });

   







    /* ================= STYLES ================= */
    const style = document.createElement("style");
    style.innerHTML = `

    #mpulseTagHoverPanel {
      position: fixed;
      z-index: 9999;
      width: 380px;
      max-height: 70vh;
      background: #f9fbfd;
      border: 1px solid #ccc;
      border-radius: 6px;
      box-shadow: 0 6px 18px rgba(0,0,0,0.25);
      display: none;
      overflow: hidden;
    }

    #mpulseTagHoverPanel .header-actions button {
      background: transparent;
      border: none;
      color: white;
      font-size: 14px;
      cursor: pointer;
      margin-left: 6px;
    }

    
    #mpulseTagHoverPanel.open {
      display: block;
    }
    
    #mpulseTagHoverPanel .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 8px;
      font-weight: 600;
      background: #0078d4;
      color: white;
    }
    
    #mpulseTagHoverPanel .header button {
      background: transparent;
      border: none;
      color: white;
      font-size: 16px;
      cursor: pointer;
    }
    
    #mpulseTagHoverPanel .content {
      padding: 8px;
      overflow-y: auto;
      max-height: calc(70vh - 36px);
    }

    #mpulseTagHoverPanel {
      resize: both;
      min-width: 320px;
      min-height: 200px;
    }
    
    #mpulseTagHoverPanel .header {
      user-select: none;
    }


    .collapsed > .children {
      display: none;
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
    
        Object.entries(TAG_CONFIG).forEach( ([equipClass,models]) => {
            const classBlock = document.createElement("div");

            (function makePanelDraggable(panel) {
              const header = panel.querySelector(".header");
              if (!header) return;
            
              let isDragging = false;
              let startX, startY, startLeft, startTop;
            
              header.style.cursor = "move";
            
              header.addEventListener("mousedown", e => {
                isDragging = true;
                startX = e.clientX;
                startY = e.clientY;
            
                const rect = panel.getBoundingClientRect();
                startLeft = rect.left;
                startTop = rect.top;
            
                panel.style.right = "auto"; // important
                panel.style.bottom = "auto";
            
                document.body.style.userSelect = "none";
              });
            
              document.addEventListener("mousemove", e => {
                if (!isDragging) return;
            
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
            
                panel.style.left = `${startLeft + dx}px`;
                panel.style.top = `${startTop + dy}px`;
              });
            
              document.addEventListener("mouseup", () => {
                isDragging = false;
                document.body.style.userSelect = "";
              });
            })(panel);


            

    
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
                    }
                    ;
    
                    tagEls.push(tag);
                    modelChildren.appendChild(tag);
                }
                );
    
                modelBlock.appendChild(modelChildren);
                classChildren.appendChild(modelBlock);
            }
            );
    
            classBlock.appendChild(classChildren);
            ui.appendChild(classBlock);
        }
        );
    
        function syncUI() {
            tagEls.forEach(t => t.classList.toggle("selected", selections.has(t.dataset.line)));
        }
    
    
    /* ================= SEARCH ================= */
    panel.querySelector("#tagSearch").addEventListener("input", e => {
        const q = e.target.value.toLowerCase();
        tagEls.forEach(t => {
            t.style.display = t.dataset.line.toLowerCase().includes(q) ? "" : "none";
        }
        );
    }
    );

    /* ================= CLEAR ALL ================= */
    panel.querySelector("#clearTags").onclick = () => {
        selections.clear();
        writeEditor();
        syncUI();
    }
    ;

    /* ================= RECORD CHANGE WATCH ================= */
    const interval = setInterval( () => {
        if (!isInventoryRecordPage()) {
            panel.remove();
            return;
        }

        const newEditor = findEditor();

        if (newEditor && newEditor !== editor) {
            editor = newEditor;
            loadFromEditor();
            return;
        }

        if (editor && editor.getData() !== lastEditorData) {
            loadFromEditor();
        }
    }
    , 750);

    window.__mpulseTagPickerCleanup = () => clearInterval(interval);

    /* ================= INIT ================= */
    

    console.log("✅ Tag Picker v1.3.2 loaded (GitHub config, Inventory-only)");

}
)();
