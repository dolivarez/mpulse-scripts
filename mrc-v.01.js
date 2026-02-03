(function () {

  /* ================= CLEANUP ================= */
  document.getElementById("mpulseReviewPanel")?.remove();
  document.getElementById("mpulseReviewLauncher")?.remove();

  /* ================= CONFIG ================= */
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
    "Required field missing"
  ];

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
  function findEditor(fieldname) {
    return Object.values(CKEDITOR.instances || {})
      .find(e => e.element?.getAttribute("fieldname") === fieldname);
  }

  const reviewEditor = findEditor(REVIEW_FIELDNAME);

  if (!reviewEditor) {
    console.error("❌ Review CKEditor not found");
    return;
  }

  function lockEditor(editor) {
    editor?.setReadOnly(true);
  }

  function unlockEditor(editor) {
    editor?.setReadOnly(false);
  }


  function attachReviewButtonWhenEditable() {
    const editor = findEditor(REVIEW_FIELDNAME);
    if (!editor) return;
  
    const ta = document.querySelector(
      `textarea[fieldname="${REVIEW_FIELDNAME}"]`
    );
    if (!ta) return;
  
    const label = ta.closest("div")?.querySelector("label");
    if (!label) return;
  
    // 🔒 Remove button if editor is read-only
    if (editor.readOnly) {
      label.querySelector(".maint-review-btn")?.remove();
      delete label.dataset.reviewAttached;
      return;
    }
  
    // ✅ Already attached
    if (label.dataset.reviewAttached) return;
  
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
      if (!document.getElementById("mpulseReviewPanel")) {
        openPanel();
      }
    };
  
    label.appendChild(btn);
    label.dataset.reviewAttached = "true";
  
    console.log("📝 Review button attached (editable state)");
  }


  /* ================= STATE ================= */
  let selectedStatus = null;
  const selectedCorrections = new Set();


  /* ================= PANEL ================= */
  function openPanel() {
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
          <input type="checkbox" data-correction="${label}"> ${label}
        </label>
      `;
      wrap.appendChild(row);
    });

    wrap.addEventListener("change", e => {
      const val = e.target.getAttribute("data-correction");
      if (!val) return;
      e.target.checked
        ? selectedCorrections.add(val)
        : selectedCorrections.delete(val);
    });
  }

  /* ================= APPLY ================= */  
  function applyReview() {
    if (!selectedStatus) {
      alert("Select a review status first.");
      return;
    }
  
    const r = getReviewerInfo();
    unlockEditor(reviewEditor);
  
    let html = `
      <p><strong>Maintenance Review Status:</strong> ${selectedStatus}</p>
      <p><strong>Reviewed by:</strong> ${r.name}</p>
      <p><strong>Review Date:</strong> ${r.date}</p>
    `;
  
    if (selectedStatus === "Requires Correction") {
      html += `
        <p><strong>Corrections Required:</strong></p>
        <ul>
          ${[...selectedCorrections].map(c => `<li>${c}</li>`).join("")}
        </ul>
      `;
    }
  
    if (selectedStatus === "Approved") {
      html += `
        <p><strong>Review Outcome:</strong></p>
        <ul>
          <li>No documentation or execution deficiencies were identified during maintenance review.</li>
        </ul>
      `;
    }
  
    reviewEditor.setData(html);
    lockEditor(reviewEditor);
  
    console.log("✅ Maintenance review applied");
  }

  (function watchReviewEditState() {
    let lastState = null;
  
    setInterval(() => {
      const editor = findEditor(REVIEW_FIELDNAME);
      if (!editor) return;
  
      const editable = !editor.readOnly;
  
      if (editable !== lastState) {
        attachReviewButtonWhenEditable();
        lastState = editable;
      }
    }, 400);
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
      // 🧹 Close review panel on save/tab switch
      document.getElementById("mpulseReviewPanel")?.remove();
  
      return original.apply(this, args);
    };
  
    console.log("✅ SaveTabAndKey intercepted for Maintenance Review");
  })();

  


})();
