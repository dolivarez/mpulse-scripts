(function () {
  const SCRIPT_VERSION = "1.5.0";
  const BUTTON_ID = "toolbarEscalateEmailButton";
  const BUTTON_TEXT = "Draft Escalation Email";
  const BUTTON_TITLE = "Draft escalation email / copy formatted email";
  const ACTION_MENU_SELECTOR = ".action-menu-items ul.itemDetailActionBtns";

  const DEFAULT_TO = "";
  const DEFAULT_CC = "";

  const MODAL_ID = "toolbarEscalateEmailModal";
  const OVERLAY_ID = "toolbarEscalateEmailOverlay";

  const TEMPLATE_OPTIONS = [
    { key: "general", label: "General Review Needed" },
    { key: "approval", label: "Approval Needed" },
    { key: "delayed", label: "Work Delayed / Stalled" },
    { key: "qa", label: "QA Review Needed" }
  ];

  function log(...args) {
    console.log(`[${BUTTON_ID} v${SCRIPT_VERSION}]`, ...args);
  }

  function normalizeText(value) {
    return (value || "").replace(/\s+/g, " ").trim();
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getText(selectors) {
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (!el) continue;
      const txt = normalizeText(el.innerText || el.textContent || "");
      if (txt) return txt;
    }
    return "";
  }

  function htmlToText(html) {
    const div = document.createElement("div");
    div.innerHTML = html || "";
    return normalizeText(div.textContent || div.innerText || "");
  }

  function getCommentsText() {
    const nodes = Array.from(
      document.querySelectorAll(".dx-scrollview-content .ng-binding, .dx-scrollview-content")
    );

    const texts = nodes
      .map(node => htmlToText(node.innerHTML))
      .filter(Boolean);

    return texts[0] || "";
  }

  function getLatestCommentText() {
    const text = getCommentsText();
    if (!text) return "";

    const parts = text.split(/(?=\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}:\d{2}\s+[AP]M)/);
    let latest = parts.length ? parts[parts.length - 1].trim() : text.trim();

    if (latest.length > 450) {
      latest = latest.slice(0, 450).trim() + "... [truncated]";
    }

    return latest;
  }

  function getGridItems(selector) {
    try {
      const el = document.querySelector(selector);
      if (!el || !window.DevExpress?.ui?.dxDataGrid) return [];
      const instance = window.DevExpress.ui.dxDataGrid.getInstance(el);
      if (!instance) return [];
      return instance.getDataSource()?.items?.() || [];
    } catch (err) {
      log(`Failed reading grid ${selector}`, err);
      return [];
    }
  }

  function getAssetNames() {
    return getGridItems("#AssetList")
      .map(row =>
        normalizeText(
          row.Description ||
          row.AssetDesc ||
          row.EquipmentDesc ||
          row.Code ||
          ""
        )
      )
      .filter(Boolean);
  }

  function getPersonnelNames() {
    return getGridItems("#PersonalList")
      .map(row =>
        normalizeText(
          row.Description ||
          row.EmployeeDesc ||
          row.PersonnelDesc ||
          row.Code ||
          ""
        )
      )
      .filter(Boolean);
  }

  function buildWorkOrderUrl() {
    try {
      const scope = angular.element(document.body).scope();
      const recordKey =
        scope?.$parent?.listviewlayouts?.SelectedRecordKey ||
        scope?.$parent?.listviewlayouts?.SelectedObject?.RecordKey ||
        scope?.$parent?.dxValue?.[0]?.RecordKey;

      if (recordKey) {
        return `${location.origin}/#/main/fal/WorkOrderRecords/${recordKey}?Flag=WKO`;
      }
    } catch (e) {
      log("Failed to resolve RecordKey from scope", e);
    }

    return location.href || location.origin;
  }

  function wrapText(text, width) {
    if (!text) return "";
    const words = text.split(/\s+/);
    const lines = [];
    let current = "";

    for (const word of words) {
      if ((current + " " + word).trim().length > width) {
        lines.push(current.trim());
        current = word;
      } else {
        current += " " + word;
      }
    }

    if (current.trim()) lines.push(current.trim());
    return lines.join("\n");
  }

  function getTemplateContent(templateKey) {
    switch (templateKey) {
      case "approval":
        return {
          label: "Approval Needed",
          subjectPrefix: "Approval Needed",
          actionHeader: "Approval Requested",
          defaultContext: "Approval is needed before work can proceed.",
          issue: "This work order requires approval before work can proceed.",
          impact: "Progress may stop until approval or direction is provided.",
          action: "Please review and approve, or advise next steps."
        };

      case "delayed":
        return {
          label: "Work Delayed / Stalled",
          subjectPrefix: "Work Delayed",
          actionHeader: "Action Requested",
          defaultContext: "Work has stalled and needs review / next-step decision.",
          issue: "Work on this work order appears delayed or stalled.",
          impact: "Repair or maintenance progress may continue to slip without follow-up.",
          action: "Please review current status and advise on next steps."
        };

      case "qa":
        return {
          label: "QA Review Needed",
          subjectPrefix: "QA Review Needed",
          actionHeader: "QA Review Requested",
          defaultContext: "Completed work requires QA review before closure.",
          issue: "This work order requires QA review before final closure or next action.",
          impact: "Closure or release may be delayed until QA review is completed.",
          action: "Please review completed work and advise whether QA acceptance can be recorded."
        };

      case "general":
      default:
        return {
          label: "General Review Needed",
          subjectPrefix: "Review Needed",
          actionHeader: "Action Requested",
          defaultContext: "This work order needs review and next-step direction.",
          issue: "This work order needs review and follow-up.",
          impact: "Progress may be delayed until direction is provided.",
          action: "Please review and advise on next steps."
        };
    }
  }

  function buildSubject(templateKey) {
    const woId = getText(["#ID"]);
    const description = getText(["#Description", "#EQUDescription"]);
    const template = getTemplateContent(templateKey);

    return `WO ${woId || "[Unknown]"} - ${template.subjectPrefix}${description ? " - " + description : ""}`;
  }

  function section(title, bodyLines) {
    const cleaned = (bodyLines || []).filter(Boolean);
    if (!cleaned.length) return "";
    return [
      title,
      "-".repeat(title.length),
      ...cleaned,
      ""
    ].join("\n");
  }

  function buildPlainTextBody(templateKey, userContext) {
    const woId = getText(["#ID"]);
    const description = getText(["#Description", "#EQUDescription"]);
    const status = getText(["#StatusDesc"]);
    const dateOpen = getText(["#Open"]);
    const dueDate = getText(["#Due"]);
    const assetNames = getAssetNames();
    const personnelNames = getPersonnelNames();
    const latestComment = getLatestCommentText();
    const link = buildWorkOrderUrl();
    const template = getTemplateContent(templateKey);

    const summaryLines = [
      `Work Order: ${woId || "[Unavailable]"}`,
      description ? `Description: ${description}` : "",
      status ? `Status: ${status}` : "",
      dateOpen ? `Date Opened: ${dateOpen}` : "",
      dueDate ? `Due Date: ${dueDate}` : "",
      assetNames.length ? `Assets: ${assetNames.join(", ")}` : "",
      personnelNames.length ? `Assigned Personnel: ${personnelNames.join(", ")}` : ""
    ].filter(Boolean);

    const lines = [
      "ACTION REQUIRED",
      "",
      section("WORK ORDER SUMMARY", summaryLines),
      section("ISSUE", [wrapText(template.issue, 95)]),
      section("IMPACT", [wrapText(template.impact, 95)]),
      section(template.actionHeader.toUpperCase(), [wrapText(template.action, 95)]),
      userContext ? section("ADDITIONAL CONTEXT", [wrapText(userContext, 95)]) : "",
      latestComment ? section("LATEST UPDATE", [wrapText(latestComment, 95)]) : "",
      section("OPEN WORK ORDER", [link]),
      "Thank you."
    ].filter(Boolean);

    return lines.join("\n");
  }

  function buildHtmlBody(templateKey, userContext) {
    const woId = getText(["#ID"]);
    const description = getText(["#Description", "#EQUDescription"]);
    const status = getText(["#StatusDesc"]);
    const dateOpen = getText(["#Open"]);
    const dueDate = getText(["#Due"]);
    const assetNames = getAssetNames();
    const personnelNames = getPersonnelNames();
    const latestComment = getLatestCommentText();
    const link = buildWorkOrderUrl();
    const template = getTemplateContent(templateKey);

    const summaryRows = [
      woId ? `<div><b>Work Order:</b> ${escapeHtml(woId)}</div>` : "",
      description ? `<div><b>Description:</b> ${escapeHtml(description)}</div>` : "",
      status ? `<div><b>Status:</b> ${escapeHtml(status)}</div>` : "",
      dateOpen ? `<div><b>Date Opened:</b> ${escapeHtml(dateOpen)}</div>` : "",
      dueDate ? `<div><b>Due Date:</b> ${escapeHtml(dueDate)}</div>` : "",
      assetNames.length ? `<div><b>Assets:</b> ${escapeHtml(assetNames.join(", "))}</div>` : "",
      personnelNames.length ? `<div><b>Assigned Personnel:</b> ${escapeHtml(personnelNames.join(", "))}</div>` : ""
    ].filter(Boolean).join("");

    function htmlSection(title, bodyHtml) {
      if (!bodyHtml) return "";
      return `
        <div style="margin-top:14px;">
          <div style="font-weight:bold; text-transform:uppercase; margin-bottom:4px;">${escapeHtml(title)}</div>
          <div style="border-top:1px solid #cfcfcf; margin-bottom:8px;"></div>
          <div>${bodyHtml}</div>
        </div>
      `;
    }

    return `
      <div style="font-family:Arial,sans-serif; font-size:13px; line-height:1.45; color:#222;">
        <div style="font-weight:bold; font-size:15px; margin-bottom:14px;">ACTION REQUIRED</div>

        ${htmlSection("Work Order Summary", summaryRows)}
        ${htmlSection("Issue", `<div>${escapeHtml(template.issue)}</div>`)}
        ${htmlSection("Impact", `<div>${escapeHtml(template.impact)}</div>`)}
        ${htmlSection(template.actionHeader, `<div>${escapeHtml(template.action)}</div>`)}
        ${userContext ? htmlSection("Additional Context", `<div>${escapeHtml(userContext)}</div>`) : ""}
        ${latestComment ? htmlSection("Latest Update", `<div>${escapeHtml(latestComment)}</div>`) : ""}
        ${htmlSection("Open Work Order", `<div><a href="${escapeHtml(link)}">Open Work Order</a></div><div style="margin-top:6px; color:#666;">${escapeHtml(link)}</div>`)}
        <div style="margin-top:14px;">Thank you.</div>
      </div>
    `;
  }

  function openOutlookDraft(templateKey, userContext) {
    const subject = buildSubject(templateKey);
    const body = buildPlainTextBody(templateKey, userContext);

    const parts = [];
    if (DEFAULT_TO) parts.push("to=" + encodeURIComponent(DEFAULT_TO));
    if (DEFAULT_CC) parts.push("cc=" + encodeURIComponent(DEFAULT_CC));
    parts.push("subject=" + encodeURIComponent(subject));
    parts.push("body=" + encodeURIComponent(body));

    const url = "https://outlook.office.com/mail/deeplink/compose?" + parts.join("&");
    window.open(url, "_blank");
  }

  async function copyFormattedEmail(templateKey, userContext) {
    const subject = buildSubject(templateKey);
    const plainText = buildPlainTextBody(templateKey, userContext);
    const html = buildHtmlBody(templateKey, userContext);

    if (navigator.clipboard && window.ClipboardItem) {
      const item = new ClipboardItem({
        "text/plain": new Blob([`Subject: ${subject}\n\n${plainText}`], { type: "text/plain" }),
        "text/html": new Blob([html], { type: "text/html" })
      });
      await navigator.clipboard.write([item]);
      return true;
    }

    await navigator.clipboard.writeText(`Subject: ${subject}\n\n${plainText}`);
    return false;
  }

  function removeModal() {
    document.getElementById(MODAL_ID)?.remove();
    document.getElementById(OVERLAY_ID)?.remove();
  }

  function showModalStatus(message, isError) {
    const statusEl = document.querySelector("#escalateModalStatus");
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.style.color = isError ? "#c62828" : "#2e7d32";
  }

  function applyTemplateSelection(modal, templateKey) {
    const template = getTemplateContent(templateKey);
    modal.dataset.selectedTemplate = templateKey;

    modal.querySelectorAll(".escalate-template-option").forEach(btn => {
      const isActive = btn.dataset.templateKey === templateKey;
      btn.style.borderColor = isActive ? "#1976d2" : "#cfd8dc";
      btn.style.background = isActive ? "#eaf3ff" : "#fff";
      btn.style.color = "#222";
    });

    const contextBox = modal.querySelector("#escalateContextInput");
    if (contextBox && !contextBox.dataset.userEdited) {
      contextBox.value = template.defaultContext;
    }

    showModalStatus("Tip: Copy Formatted Email and paste into Outlook for a clickable link and richer formatting.", false);
  }

  function createModal() {
    removeModal();

    const overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.background = "rgba(0,0,0,0.35)";
    overlay.style.zIndex = "99998";

    const modal = document.createElement("div");
    modal.id = MODAL_ID;
    modal.style.position = "fixed";
    modal.style.top = "50%";
    modal.style.left = "50%";
    modal.style.transform = "translate(-50%, -50%)";
    modal.style.width = "min(620px, calc(100vw - 32px))";
    modal.style.maxHeight = "calc(100vh - 48px)";
    modal.style.overflow = "auto";
    modal.style.background = "#fff";
    modal.style.border = "1px solid #cfd8dc";
    modal.style.borderRadius = "8px";
    modal.style.boxShadow = "0 12px 32px rgba(0,0,0,0.2)";
    modal.style.padding = "16px";
    modal.style.zIndex = "99999";
    modal.style.fontFamily = "Arial, sans-serif";
    modal.style.color = "#222";

    modal.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
        <div style="font-size:16px; font-weight:bold;">Escalation Email</div>
        <button type="button" id="escalateModalCloseBtn" style="border:none; background:transparent; font-size:20px; cursor:pointer; line-height:1;">×</button>
      </div>

      <div style="font-size:13px; margin-bottom:8px; font-weight:bold;">Select template</div>

      <div id="escalateTemplateOptions" style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:14px;">
        ${TEMPLATE_OPTIONS.map(opt => `
          <button
            type="button"
            class="escalate-template-option"
            data-template-key="${opt.key}"
            style="
              padding:10px 12px;
              border:1px solid #cfd8dc;
              border-radius:6px;
              background:#fff;
              cursor:pointer;
              text-align:left;
              font-size:13px;
            "
          >${opt.label}</button>
        `).join("")}
      </div>

      <div style="font-size:13px; margin-bottom:8px; font-weight:bold;">Additional context</div>
      <textarea
        id="escalateContextInput"
        style="
          width:100%;
          min-height:110px;
          resize:vertical;
          border:1px solid #cfd8dc;
          border-radius:6px;
          padding:10px;
          font-family:Arial, sans-serif;
          font-size:13px;
          box-sizing:border-box;
        "
      ></textarea>

      <div id="escalateModalStatus" style="margin-top:10px; font-size:12px; color:#2e7d32;">
        Tip: Copy Formatted Email and paste into Outlook for a clickable link and richer formatting.
      </div>

      <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:14px; flex-wrap:wrap;">
        <button
          type="button"
          id="escalateModalCancelBtn"
          style="
            padding:8px 12px;
            border:1px solid #cfd8dc;
            border-radius:6px;
            background:#fff;
            cursor:pointer;
            font-size:13px;
          "
        >Cancel</button>

        <button
          type="button"
          id="escalateModalCopyBtn"
          style="
            padding:8px 12px;
            border:1px solid #2e7d32;
            border-radius:6px;
            background:#388e3c;
            color:#fff;
            cursor:pointer;
            font-size:13px;
          "
        >Copy Formatted Email</button>

        <button
          type="button"
          id="escalateModalDraftBtn"
          style="
            padding:8px 12px;
            border:1px solid #1565c0;
            border-radius:6px;
            background:#1976d2;
            color:#fff;
            cursor:pointer;
            font-size:13px;
          "
        >Draft Email</button>
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(modal);

    const contextInput = modal.querySelector("#escalateContextInput");

    contextInput.addEventListener("input", function () {
      this.dataset.userEdited = "true";
    });

    modal.querySelectorAll(".escalate-template-option").forEach(btn => {
      btn.addEventListener("click", function () {
        applyTemplateSelection(modal, this.dataset.templateKey);
      });
    });

    function closeModal() {
      removeModal();
    }

    overlay.addEventListener("click", closeModal);
    modal.querySelector("#escalateModalCloseBtn").addEventListener("click", closeModal);
    modal.querySelector("#escalateModalCancelBtn").addEventListener("click", closeModal);

    modal.querySelector("#escalateModalDraftBtn").addEventListener("click", function () {
      const selectedTemplate = modal.dataset.selectedTemplate || "general";
      const context = contextInput.value.trim();
      openOutlookDraft(selectedTemplate, context);
    });

    modal.querySelector("#escalateModalCopyBtn").addEventListener("click", async function () {
      const selectedTemplate = modal.dataset.selectedTemplate || "general";
      const context = contextInput.value.trim();

      try {
        const richCopied = await copyFormattedEmail(selectedTemplate, context);
        if (richCopied) {
          showModalStatus("Formatted email copied. Open a new Outlook message and paste it into the body.", false);
        } else {
          showModalStatus("Plain text email copied. Rich clipboard was not available in this browser context.", false);
        }
      } catch (err) {
        log("Clipboard copy failed", err);
        showModalStatus("Unable to copy email content to clipboard.", true);
      }
    });

    applyTemplateSelection(modal, "general");
    contextInput.focus();
  }

  function copyNearbyButtonStyle(button) {
    const reportButton =
      document.querySelector("#generateWorkOrderReportBtn") ||
      document.querySelector("#toolbarReportButton") ||
      Array.from(document.querySelectorAll("button, a")).find(el =>
        /report/i.test((el.innerText || "").trim())
      );

    if (!reportButton) return false;

    if (reportButton.className) button.className = reportButton.className;
    if (reportButton.style?.cssText) button.style.cssText = reportButton.style.cssText;

    return true;
  }

  function applyFallbackStyle(button) {
    button.style.display = "inline-flex";
    button.style.alignItems = "center";
    button.style.gap = "6px";
    button.style.padding = "8px 12px";
    button.style.marginLeft = "8px";
    button.style.border = "1px solid #cfd8dc";
    button.style.borderRadius = "4px";
    button.style.background = "#fff";
    button.style.color = "#333";
    button.style.cursor = "pointer";
    button.style.fontSize = "13px";
    button.style.lineHeight = "1.2";
  }

  function createButton() {
    const button = document.createElement("button");
    button.type = "button";
    button.id = BUTTON_ID;
    button.title = BUTTON_TITLE;
    button.innerHTML = `<i class="fa fa-paper-plane" aria-hidden="true"></i>`;
  
    // Force compact icon-only toolbar styling
    button.style.setProperty("display", "inline-flex", "important");
    button.style.setProperty("align-items", "center", "important");
    button.style.setProperty("justify-content", "center", "important");
    button.style.setProperty("width", "24px", "important");
    button.style.setProperty("height", "24px", "important");
    button.style.setProperty("min-width", "24px", "important");
    button.style.setProperty("min-height", "24px", "important");
    button.style.setProperty("padding", "0", "important");
    button.style.setProperty("margin", "0", "important");
    button.style.setProperty("background", "transparent", "important");
    button.style.setProperty("background-color", "transparent", "important");
    button.style.setProperty("border", "none", "important");
    button.style.setProperty("border-radius", "0", "important");
    button.style.setProperty("box-shadow", "none", "important");
    button.style.setProperty("outline", "none", "important");
    button.style.setProperty("appearance", "none", "important");
    button.style.setProperty("-webkit-appearance", "none", "important");
    button.style.setProperty("cursor", "pointer", "important");
    button.style.setProperty("color", "#666", "important");
    button.style.setProperty("line-height", "1", "important");
    button.style.setProperty("font-size", "0", "important");
    button.style.setProperty("vertical-align", "middle", "important");
  
    const icon = button.querySelector("i");
    icon.style.setProperty("font-size", "13px", "important");
    icon.style.setProperty("line-height", "1", "important");
    icon.style.setProperty("display", "inline-block", "important");
    icon.style.setProperty("margin", "0", "important");
    icon.style.setProperty("padding", "0", "important");
    icon.style.setProperty("color", "#666", "important");
    icon.style.setProperty("pointer-events", "none", "important");
  
    button.addEventListener("mouseenter", () => {
      button.style.setProperty("background-color", "transparent", "important");
      icon.style.setProperty("color", "#0078d7", "important");
    });
  
    button.addEventListener("mouseleave", () => {
      button.style.setProperty("background-color", "transparent", "important");
      icon.style.setProperty("color", "#666", "important");
    });
  
    button.addEventListener("focus", () => {
      button.style.setProperty("background-color", "transparent", "important");
      button.style.setProperty("outline", "none", "important");
      button.style.setProperty("box-shadow", "none", "important");
    });
  
    button.addEventListener("mousedown", () => {
      button.style.setProperty("background-color", "transparent", "important");
    });
  
    button.addEventListener("mouseup", () => {
      button.style.setProperty("background-color", "transparent", "important");
    });
  
    button.addEventListener("click", function (evt) {
      evt.preventDefault();
      evt.stopPropagation();
      createModal();
    });
  
    return button;
  }
  
  function injectButton() {
    const actionMenu = document.querySelector(ACTION_MENU_SELECTOR);
    if (!actionMenu) return false;
    if (document.getElementById(BUTTON_ID)) return true;
  
    const li = document.createElement("li");
    li.style.setProperty("list-style", "none", "important");
    li.style.setProperty("margin", "0 6px 0 0", "important");
    li.style.setProperty("padding", "0", "important");
    li.style.setProperty("display", "inline-flex", "important");
    li.style.setProperty("align-items", "center", "important");
    li.style.setProperty("background", "transparent", "important");
    li.style.setProperty("background-color", "transparent", "important");
    li.style.setProperty("border", "none", "important");
    li.style.setProperty("box-shadow", "none", "important");
  
    li.appendChild(createButton());
    actionMenu.appendChild(li);
  
    log("Button injected");
    return true;
  }

  function waitForActionMenuAndInject() {
    if (injectButton()) return;

    const observer = new MutationObserver(() => {
      if (injectButton()) observer.disconnect();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  function init() {
    try {
      waitForActionMenuAndInject();
    } catch (err) {
      log("Initialization failed", err);
    }
  }

  init();
})();
