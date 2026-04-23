(function () {

  /* ================= CLEANUP ================= */
  document.getElementById("mpulseQaReviewPanel")?.remove();
  document.querySelectorAll(".qa-review-btn").forEach(b => b.remove());

  /* ================= CONFIG ================= */

  // Replace with Equipment record QA fields
  const REVIEW_FIELDNAME = "CustomFields.OBJ_979"; // Equipment QA memo field
  const STATUS_FIELD = "OBJ_980";                  // Equipment QA status field

  const PANEL_TITLE = "Scheduled Maintenance QA Review";
  const BUTTON_LABEL = "🧪 QA Review";

  const QA_GROUPS = [
    "QA",
    "QA Manager",
    "Quality Assurance",
    "MPulse Custodian (System Designer)"
  ];

  const STATUS_OPTIONS = {
    APPROVED: "APPROVED",
    CORRECTION: "CORRECTION"
  };

  const CORRECTION_OPTIONS = [
    "Required field missing",
    "Specification missing",
    "Documentation incomplete",
    "Setup / configuration issue",
    "Status / classification issue",
    "Media / attachment missing",
    "Review data incomplete",
    "Other"
  ];

  let __ALLOW_WRITE__ = false;
  let selectedStatus = null;
  const selectedCorrections = new Set();

  /* ================= USER INFO ================= */

  function getUserName() {
    return document
      .querySelector("#navbar span.text-capitalize span")
      ?.textContent?.trim() || "Unknown User";
  }

  function getUserGroup() {
    let el = document.querySelector(".userDetails small");
    if (el?.textContent?.trim()) return el.textContent.trim();

    el = document.querySelector("#navbar small");
    if (el?.textContent?.trim()) return el.textContent.trim();

    return null;
  }

  function isQaUser() {
    return QA_GROUPS.includes(getUserGroup());
  }

  /* ================= RECORD ACCESS ================= */

  function getRecord() {
    const scope = angular
      .element(document.querySelector('[ng-controller]'))
      .scope();

    return scope?.getSelectedRecordObj?.() || null;
  }

  function setStatus(value) {
    const record = getRecord();
    if (!record) return;

    angular.element(document.body)
      .injector()
      .get("$rootScope")
      .$applyAsync(() => {
        if (!record.CustomFields) record.CustomFields = {};
        record.CustomFields[STATUS_FIELD] = value;
      });

    console.log("🟢 QA status set:", value);
  }

  /* ================= CKEDITOR ================= */

  function getEditor() {
    return Object.values(CKEDITOR.instances || {})
      .find(e => e.element?.getAttribute("fieldname") === REVIEW_FIELDNAME);
  }

  function getReviewLabel() {
    const ta = document.querySelector(
      `textarea[fieldname="${REVIEW_FIELDNAME}"]`
    );
    return ta?.closest("div")?.querySelector("label") || null;
  }

  function protectEditor(editor) {
    if (!editor || editor.__PROTECTED__) return;
    editor.__PROTECTED__ = true;

    editor.on("key", e => { if (!__ALLOW_WRITE__) e.cancel(); });
    editor.on("paste", e => { if (!__ALLOW_WRITE__) e.cancel(); });
    editor.on("beforeCommandExec", e => {
      if (!__ALLOW_WRITE__) e.cancel();
    });
  }

  function appendToMemo(html) {
    const editor = getEditor();
    if (!editor) return false;

    const existing = editor.getData() || "";
    const sep = `<hr style="margin:15px 0;border-top:1px solid #ccc;">`;

    __ALLOW_WRITE__ = true;
    editor.setData(existing ? existing + sep + html : html);
    __ALLOW_WRITE__ = false;

    return true;
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  /* ================= PANEL ================= */

  function openPanel() {
    if (document.getElementById("mpulseQaReviewPanel")) return;

    selectedStatus = null;
    selectedCorrections.clear();

    const panel = document.createElement("div");
    panel.id = "mpulseQaReviewPanel";
    panel.style.cssText = `
      position:fixed;
      top:80px;
      right:20px;
      width:390px;
      background:#fff;
      border:1px solid #ccc;
      border-radius:6px;
      box-shadow:0 4px 12px rgba(0,0,0,.15);
      font-family:Arial;
      z-index:99999;
    `;

    panel.innerHTML = `
      <div style="padding:10px;border-bottom:1px solid #ddd;font-weight:bold">
        ${PANEL_TITLE}
      </div>
      <div style="padding:10px" id="panelBody"></div>
      <div style="padding:10px;border-top:1px solid #ddd">
        <button id="applyBtn">Apply</button>
        <button id="closeBtn" style="float:right">Close</button>
      </div>
    `;

    document.body.appendChild(panel);

    if (isQaUser()) {
      renderQaPanel(panel);
    } else {
      panel.querySelector("#panelBody").innerHTML =
        "<div style='font-size:12px'>No QA review permission.</div>";
      panel.querySelector("#applyBtn").style.display = "none";
    }

    panel.querySelector("#closeBtn").onclick = () => panel.remove();
  }

  function renderQaPanel(panel) {
    const body = panel.querySelector("#panelBody");

    body.innerHTML = `
      <div style="font-weight:bold;margin-bottom:6px">QA Decision</div>
      <div style="display:flex;gap:8px;margin-bottom:10px">
        <button data-status="${STATUS_OPTIONS.APPROVED}">Approve</button>
        <button data-status="${STATUS_OPTIONS.CORRECTION}">Requires Correction</button>
      </div>
      <div id="corrSection" style="display:none;margin-top:12px"></div>
    `;

    body.querySelectorAll("button[data-status]").forEach(btn => {
      btn.onclick = () => {
        selectedStatus = btn.dataset.status;

        body.querySelectorAll("button[data-status]").forEach(b => {
          b.style.background = "#fff";
          b.style.color = "";
        });

        btn.style.background = "#7c3aed";
        btn.style.color = "#fff";

        const showCorrections =
          selectedStatus === STATUS_OPTIONS.CORRECTION;

        body.querySelector("#corrSection").style.display =
          showCorrections ? "block" : "none";

        if (showCorrections) renderCorrections(panel);
      };
    });

    panel.querySelector("#applyBtn").onclick = () => {
      try {
        if (!selectedStatus) return alert("Select QA decision.");

        let html = `
          <div>
            <strong>QA Status:</strong> ${selectedStatus}<br>
            <strong>By:</strong> ${getUserName()}<br>
            <strong>Date:</strong> ${new Date().toLocaleString()}
        `;

        if (selectedStatus === STATUS_OPTIONS.CORRECTION) {
          const freeText = panel.querySelector("#qaFreeText")?.value?.trim();

          if (!selectedCorrections.size && !freeText) {
            return alert("Select at least one correction or enter QA comments.");
          }

          if (selectedCorrections.size) {
            html += `
              <div style="margin-top:8px"><strong>Corrections Needed:</strong></div>
              <ul>
            `;

            selectedCorrections.forEach(c => {
              if (c === "Other") {
                const otherInput =
                  panel.querySelector('[data-other-input="true"]');

                const txt = otherInput?.value?.trim();

                if (!txt) throw new Error("OTHER_TEXT_REQUIRED");

                html += `<li>Other: ${escapeHtml(txt)}</li>`;
              } else {
                html += `<li>${escapeHtml(c)}</li>`;
              }
            });

            html += "</ul>";
          }

          if (freeText) {
            html += `
              <div style="margin-top:8px">
                <strong>QA Comments:</strong><br>
                ${escapeHtml(freeText).replace(/\n/g, "<br>")}
              </div>
            `;
          }
        }

        html += "</div>";

        if (!appendToMemo(html)) return;

        setStatus(selectedStatus);
        panel.remove();

      } catch (err) {
        if (err.message === "OTHER_TEXT_REQUIRED") {
          alert("Please describe the 'Other' correction.");
          return;
        }

        console.error(err);
      }
    };
  }

  function renderCorrections(panel) {
    const section = panel.querySelector("#corrSection");

    section.innerHTML = `
      <div style="font-weight:bold;margin-bottom:6px">Select corrections needed</div>
      <div id="corrOptions"></div>
      <div style="margin-top:10px">
        <div style="font-weight:bold;margin-bottom:4px">QA comments</div>
        <textarea
          id="qaFreeText"
          placeholder="Enter QA comments or correction details..."
          style="width:100%;min-height:85px;padding:8px;font-size:12px;border:1px solid #ccc;border-radius:6px;resize:vertical;"
        ></textarea>
      </div>
    `;

    const optionsHost = section.querySelector("#corrOptions");

    CORRECTION_OPTIONS.forEach(opt => {
      const row = document.createElement("div");
      row.style.margin = "4px 0";

      row.innerHTML = `
        <label style="display:flex;gap:6px;align-items:center;">
          <input type="checkbox" data-val="${opt}">
          <span>${opt}</span>
        </label>
      `;

      if (opt === "Other") {
        const input = document.createElement("input");
        input.type = "text";
        input.placeholder = "Describe the issue…";
        input.dataset.otherInput = "true";
        input.style.cssText = `
          display:none;
          width:95%;
          margin-left:22px;
          margin-top:6px;
          padding:6px 8px;
          font-size:12px;
          border:1px solid #ccc;
          border-radius:6px;
        `;
        row.appendChild(input);
      }

      optionsHost.appendChild(row);
    });

    if (section.__LISTENER_ATTACHED__) return;
    section.__LISTENER_ATTACHED__ = true;

    section.addEventListener("change", e => {
      const cb = e.target;
      if (!cb || cb.type !== "checkbox") return;

      const val = cb.dataset.val;
      if (!val) return;

      if (cb.checked) {
        selectedCorrections.add(val);
      } else {
        selectedCorrections.delete(val);
      }

      if (val === "Other") {
        const row = cb.closest("div");
        const input = row?.querySelector('[data-other-input="true"]');

        if (input) {
          input.style.display = cb.checked ? "block" : "none";
          if (!cb.checked) input.value = "";
        }
      }
    });
  }

  /* ================= EDIT MODE WATCHER ================= */

  (function watchEditMode() {
    let lastState = null;

    function check() {
      const editor = getEditor();
      if (!editor) {
        requestAnimationFrame(check);
        return;
      }

      protectEditor(editor);

      const editable = !editor.readOnly;

      if (editable !== lastState) {
        lastState = editable;

        document.querySelectorAll(".qa-review-btn")
          .forEach(b => b.remove());

        if (editable && isQaUser()) {
          const label = getReviewLabel();
          if (!label) return;

          const btn = document.createElement("button");
          btn.className = "qa-review-btn";
          btn.textContent = BUTTON_LABEL;

          Object.assign(btn.style, {
            marginLeft: "8px",
            padding: "2px 10px",
            fontSize: "12px",
            borderRadius: "12px",
            border: "1px solid #7c3aed",
            background: "#fff",
            color: "#7c3aed",
            cursor: "pointer"
          });

          btn.onclick = e => {
            e.preventDefault();
            e.stopPropagation();
            openPanel();
          };

          label.appendChild(btn);
        }
      }

      requestAnimationFrame(check);
    }

    check();
  })();

})();
