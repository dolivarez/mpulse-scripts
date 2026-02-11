(function () {

  /* ================= CLEANUP ================= */
  document.getElementById("mpulseReviewPanel")?.remove();
  // document.getElementById("mpulseReviewLauncher")?.remove();

  const REVIEW_DEBUG = false;

  function dbg(...args) {
    if (REVIEW_DEBUG) {
      console.log("🧪 MRC DEBUG:", ...args);
    }
  }


  /* ================= CONFIG ================= */
  let __ALLOW_REVIEW_WRITE__ = false;

  const REVIEW_FIELDNAME = "CustomFields.OBJ_818";

  const REVIEW_STATUSES = [
    "Requires Correction",
    "Approved"
  ];

  const CORRECTION_OPTIONS = [
    "Labor missing",
    "Inventory missing",
    "Task(s) not complete",
    "Dose missing",
    "Media missing",
    "Other costs missing",
    "Required field missing",
    "Other"
  ];

  function resetReviewUIState() {
    // Remove panel
    document.getElementById("mpulseReviewPanel")?.remove();
  
    // Remove launcher button
    document.querySelectorAll(".maint-review-btn").forEach(b => b.remove());
  
    // Clear attachment flags
    document
      .querySelectorAll("[data-review-attached]")
      .forEach(el => delete el.dataset.reviewAttached);
  
    // 🔑 Reset internal state
    selectedStatus = null;
    selectedCorrections.clear();

    window.__REVIEW_LAST_EDITOR__ = null;
  }

  function reviewPanelIsOpen() {
    return !!document.getElementById("mpulseReviewPanel");
  }

  /* ================= USER INFO ================= */
  function getReviewerInfo() {
    const nameEl = document.querySelector(
      "#navbar span.text-capitalize span"
    );
    return {
      name: nameEl?.textContent.trim() || "Unknown User",
      date: new Date().toLocaleString()
    };
  }

  /* ================= CKEDITOR ================= */

  function getReviewLabel() {
    const ta = document.querySelector(
      `textarea[fieldname="${REVIEW_FIELDNAME}"]`
    );
  
    const label = ta?.closest("div")?.querySelector("label") || null;
  
    dbg("getReviewLabel()", {
      textarea: !!ta,
      label: !!label
    });
  
    return label;
  }



  function waitForReviewEditor(cb, timeout = 4000) {
    const start = Date.now();
  
    (function check() {
      const editor = getReviewEditor();
      const ta = document.querySelector(
        `textarea[fieldname="${REVIEW_FIELDNAME}"]`
      );
  
      if (editor && ta) {
        cb(editor);
        return;
      }
  
      if (Date.now() - start > timeout) {
        console.warn("⚠ Review editor not ready in time");
        return;
      }
  
      requestAnimationFrame(check);
    })();
  }

  function getReviewEditor() {
    const editors = Object.values(CKEDITOR.instances || {});
    const match = editors.find(
      e => e.element?.getAttribute("fieldname") === REVIEW_FIELDNAME
    );
  
    dbg("getReviewEditor()", {
      found: !!match,
      editorCount: editors.length,
      readOnly: match?.readOnly
    });
  
    return match;
  }

  
  function findEditor(fieldname) {
    return Object.values(CKEDITOR.instances || {})
      .find(e => e.element?.getAttribute("fieldname") === fieldname);
  }


  function attachReviewButtonWhenEditable() {
    dbg("attachReviewButtonWhenEditable() start");
  
    const editor = getReviewEditor();
    if (!editor) {
      dbg("❌ No editor");
      return;
    }
  
    const label = getReviewLabel();
    if (!label) {
      dbg("❌ No label");
      return;
    }
  
    dbg("Editor state", { readOnly: editor.readOnly });
  
    if (editor.readOnly) {
      dbg("🔒 Editor read-only, removing button if exists");
      label.querySelector(".maint-review-btn")?.remove();
      return;
    }
  
    if (label.querySelector(".maint-review-btn")) {
      dbg("✅ Button already exists");
      return;
    }
  
    dbg("➕ Attaching review button");
  
    const btn = document.createElement("button");
    btn.className = "maint-review-btn";
    btn.textContent = "📝 Review";
  
    Object.assign(btn.style, {
      marginLeft: "8px",
      padding: "2px 10px",
      fontSize: "12px",
      borderRadius: "12px",
      border: "1px solid #0f766e",
      background: "#fff",
      color: "#0f766e",
      cursor: "pointer"
    });
  
    btn.onclick = e => {
    e.preventDefault();
    e.stopPropagation();
  
    if (reviewPanelIsOpen()) {
      dbg("⛔ Review panel already open");
      return;
    }
  
    dbg("🖱 Review button clicked");
    openReviewPanel();
  };

  
    label.appendChild(btn);
    dbg("✅ Review button attached");
  }

  function protectReviewEditor(editor) {
    if (editor.__REVIEW_PROTECTED__) return;
    editor.__REVIEW_PROTECTED__ = true;
  
    // Block typing
    editor.on("key", evt => {
      if (!__ALLOW_REVIEW_WRITE__) {
        evt.cancel();
      }
    });
  
    // Block paste
    editor.on("paste", evt => {
      if (!__ALLOW_REVIEW_WRITE__) {
        evt.cancel();
      }
    });
  
    // Block cut/delete via commands
    editor.on("beforeCommandExec", evt => {
      const blocked = [
        "cut",
        "delete",
        "backspace",
        "selectAll",
        "undo",
        "redo"
      ];
      if (!__ALLOW_REVIEW_WRITE__ && blocked.includes(evt.data.name)) {
        evt.cancel();
      }
    });
  
    // Block drag/drop text
    editor.on("contentDom", () => {
      const body = editor.document.getBody();
      body.on("drop", e => {
        if (!__ALLOW_REVIEW_WRITE__) e.cancel();
      });
    });
  
    
    
  }



  function startReviewEditWatcher() {
    if (window.__REVIEW_EDIT_WATCHER_RUNNING__) {
      // dbg("Watcher already running");
      return;
    }
  
    // dbg("🚀 Starting review watcher");
    window.__REVIEW_EDIT_WATCHER_RUNNING__ = true;
  
    let tick = 0;
  
    setInterval(() => {
      tick++;
      // dbg(`⏱ Watcher tick ${tick}`);
  
      const editor = getReviewEditor();
      const label = getReviewLabel();
  
      dbg("Watcher state", {
        editor: !!editor,
        label: !!label,
        readOnly: editor?.readOnly
      });
  
      attachReviewButtonWhenEditable();
    }, 500);
  }




  startReviewEditWatcher();


  /* ================= STATE ================= */
  let selectedStatus = null;
  const selectedCorrections = new Set();


  /* ================= PANEL ================= */
  function openReviewPanel() {
    if (reviewPanelIsOpen()) {
    dbg("⛔ openReviewPanel called but panel already exists");
    return;
  }
    selectedStatus = null;
    selectedCorrections.clear();
    const panel = document.createElement("div");
    panel.id = "mpulseReviewPanel";
    panel.style.cssText = `
      position:fixed;
      top:80px;
      right:20px;
      width:360px;
      background:#fff;
      border:1px solid #ccc;
      border-radius:6px;
      box-shadow:0 4px 12px rgba(0,0,0,.15);
      font-family:Arial,sans-serif;
      z-index:99999;
    `;

    panel.innerHTML = `
      <div style="padding:10px;border-bottom:1px solid #ddd;font-weight:bold">
        📝 Work Order Review
      </div>

      <div style="padding:10px">
        <div style="font-weight:bold;margin-bottom:6px">Review Status</div>
        <div id="statusBtns"></div>

        <div id="correctionSection" style="display:none;margin-top:12px">
          <div style="font-weight:bold;margin-bottom:6px">
            Corrections Needed
          </div>
          <div id="correctionChecks"></div>
        </div>
      </div>

      <div style="padding:10px;border-top:1px solid #ddd">
        <button id="applyBtn">Apply Review</button>
        <button id="closeBtn" style="float:right">Close</button>
      </div>
    `;

    document.body.appendChild(panel);

    renderStatusButtons(panel);
    renderCorrectionOptions(panel);

    panel.querySelector("#applyBtn").onclick = applyReview;
    panel.querySelector("#closeBtn").onclick = () => panel.remove();
  }

  /* ================= STATUS BUTTONS ================= */
  function renderStatusButtons(panel) {
    const wrap = panel.querySelector("#statusBtns");
    wrap.innerHTML = "";

    REVIEW_STATUSES.forEach(status => {
      const btn = document.createElement("button");
      btn.textContent = status;
      btn.style.cssText = `
        margin:3px;
        padding:6px 8px;
        font-size:12px;
        cursor:pointer;
      `;

      btn.onclick = () => {
        selectedStatus = status;
        panel.querySelector("#correctionSection").style.display =
          status === "Requires Correction" ? "block" : "none";
        if (status !== "Requires Correction") selectedCorrections.clear();
        syncStatusButtons(panel);
      };

      wrap.appendChild(btn);
    });
  }

  function syncStatusButtons(panel) {
    panel.querySelectorAll("#statusBtns button").forEach(btn => {
      btn.style.background =
        btn.textContent === selectedStatus ? "#cce5ff" : "";
    });
  }

  

  /* ================= CORRECTIONS ================= */
  function renderCorrectionOptions(panel) {
    const wrap = panel.querySelector("#correctionChecks");
    wrap.innerHTML = "";
  
    CORRECTION_OPTIONS.forEach(label => {
      const row = document.createElement("div");
  
      row.innerHTML = `
        <label style="font-size:12px">
          <input type="checkbox" data-correction="${label}">
          ${label}
        </label>
      `;
  
      // 👇 Add conditional textbox for "Other"
      if (label === "Other") {
        const input = document.createElement("input");
        input.type = "text";
        input.placeholder = "Describe the issue…";
        input.style.cssText = `
          display:none;
          width:95%;
          margin-left:18px;
          margin-top:4px;
          font-size:12px;
        `;
        input.dataset.otherInput = "true";
        row.appendChild(input);
      }
  
      wrap.appendChild(row);
    });
  
    wrap.addEventListener("change", e => {
      const val = e.target.getAttribute("data-correction");
      if (!val) return;
  
      if (e.target.checked) {
        selectedCorrections.add(val);
      } else {
        selectedCorrections.delete(val);
      }
  
      // Toggle "Other" textbox
      if (val === "Other") {
        const input = e.target.closest("div").querySelector("[data-other-input]");
        if (input) {
          input.style.display = e.target.checked ? "block" : "none";
          if (!e.target.checked) input.value = "";
        }
      }
    });
  }


  /* ================= APPLY ================= */  
  function applyReview() {
    if (!selectedStatus) {
      alert("Select a review status first.");
      return;
    }
  
    const editor = getReviewEditor();
    if (!editor) {
      alert("Review field not ready yet.");
      return;
    }
  
    const r = getReviewerInfo();
  
    let html = `
      <p><strong>Maintenance Review Status:</strong> ${selectedStatus}</p>
      <p><strong>Reviewed by:</strong> ${r.name}</p>
      <p><strong>Review Date:</strong> ${r.date}</p>
    `;
  
    if (selectedStatus === "Requires Correction") {
      if (!selectedCorrections.size) {
        alert("Select at least one correction item.");
        return;
      }
    
      let correctionHtml = "";
    
      [...selectedCorrections].forEach(c => {
        if (c === "Other") {
          const input = document.querySelector("[data-other-input]");
          const txt = input?.value.trim();
    
          if (!txt) {
            alert("Please describe the 'Other' correction.");
            return;
          }
    
          correctionHtml += `<li>Other: ${txt}</li>`;
        } else {
          correctionHtml += `<li>${c}</li>`;
        }
      });
    
      html += `
        <p><strong>Corrections Required:</strong></p>
        <ul>
          ${correctionHtml}
        </ul>
      `;
    }

  
    // 🔓 Temporarily allow writing
    __ALLOW_REVIEW_WRITE__ = true;
    editor.setData(html);
    __ALLOW_REVIEW_WRITE__ = false;
  
    document.getElementById("mpulseReviewPanel")?.remove();
  }





  (function interceptFormNavigationForReview() {
    if (typeof window.GetFormViewData !== "function") {
      return setTimeout(interceptFormNavigationForReview, 300);
    }
  
    if (window.__REVIEW_FORMVIEW_HOOKED__) return;
    window.__REVIEW_FORMVIEW_HOOKED__ = true;
  
    const original = window.GetFormViewData;
  
    window.GetFormViewData = function (...args) {
      // 🔥 Clear old state immediately
      resetReviewUIState();
  
      const result = original.apply(this, args);
  
      // 🔁 After MPulse finishes rebuilding the form
      setTimeout(() => {
        waitForReviewEditor(editor => {
          dbg("🧠 waitForReviewEditor callback fired", editor);
      
          protectReviewEditor(editor);
          attachReviewButtonWhenEditable();
          startReviewEditWatcher();
        });
      }, 300);

  
      return result;
    };
  })();




  /* ================= SAVE INTERCEPT ================= */
  (function interceptSaveTabAndKeyForReview() {
    if (typeof window.SaveTabAndKey !== "function") {
      return setTimeout(interceptSaveTabAndKeyForReview, 300);
    }
  
    if (window.__REVIEW_SAVE_HOOKED__) return;
    window.__REVIEW_SAVE_HOOKED__ = true;
  
    const original = window.SaveTabAndKey;
  
    window.SaveTabAndKey = function (...args) {
      resetReviewUIState();
      return original.apply(this, args);
    };
  })();

  


})();
