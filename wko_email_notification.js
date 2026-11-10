(function () {
  const SCRIPT_VERSION = "1.7.1";
  const BUTTON_ID = "toolbarEscalateEmailButton";
  const BUTTON_TITLE = "Draft work order email / copy formatted email";
  const ACTION_MENU_SELECTOR = ".action-menu-items ul.itemDetailActionBtns";

  const DEFAULT_TO = "";
  const DEFAULT_CC = "";

  const MODAL_ID = "toolbarEscalateEmailModal";
  const OVERLAY_ID = "toolbarEscalateEmailOverlay";

  // Use the internal RecordKey only after matching the displayed work-order ID.
  const TEMPLATE_OPTIONS = [
    { key: "information", label: "Information requested", subjectPrefix: "Information requested", action: "Please provide the additional information listed below so we can determine the next steps for this work order." },
    { key: "general", label: "General review", subjectPrefix: "Review requested", action: "Please review this work order and advise on next steps." },
    { key: "routing", label: "Routing / assignment", subjectPrefix: "Assignment review requested", action: "Please review this work order and confirm the appropriate assignment." }
  ];

  function log(...args) {
    console.log(`[${BUTTON_ID} v${SCRIPT_VERSION}]`, ...args);
  }

  function visibleNodes(selector) {
    return [...document.querySelectorAll(selector)].filter(node => node.getClientRects().length);
  }

  function visibleRecordId() {
    const ids = [...new Set(visibleNodes("#ID").map(node => normalizeText(node.value || node.textContent)).filter(Boolean))];
    // Multiple visible forms are ambiguous; never silently choose the first one.
    return ids.length === 1 ? ids[0] : "";
  }

  function objectRecordId(obj) {
    return normalizeText(obj?.RecordId ?? obj?.RecordID ?? obj?.WKOCode ?? obj?.WorkOrderID);
  }

  function resolveRecord() {
    const id = visibleRecordId();
    if (!id) throw new Error("Unable to identify one displayed work order. Close other record windows and reopen this email dialog.");
    const candidates = [], seen = new Set();
    for (const node of [...visibleNodes("#ID, #Description, .ng-scope, " + ACTION_MENU_SELECTOR), document.body]) {
      let scope;
      try { scope = window.angular?.element(node).scope(); } catch { continue; }
      for (let depth = 0; scope && depth < 12 && !seen.has(scope); depth++, scope = scope.$parent) {
        seen.add(scope);
        for (const obj of [scope.selectedRecord, scope.SelectedObject, scope.listviewlayouts?.SelectedObject, ...(Array.isArray(scope.dxValue) ? scope.dxValue : [])]) {
          if (obj && objectRecordId(obj) === id && /^[1-9]\d*$/.test(String(obj.RecordKey ?? ""))) candidates.push(obj);
        }
      }
    }
    const keys = [...new Set(candidates.map(obj => String(obj.RecordKey)))];
    if (keys.length !== 1) throw new Error("Unable to verify this work order's internal key. Run MPulseWorkOrderEmailDiagnostics() in the console and share the result.");
    const obj = candidates[0], key = keys[0];
    // WKO = open work orders; HST = historical (closed/cancelled) work orders.
    const flags = [...new Set(candidates.map(obj => normalizeText(obj.RecordFlag).toUpperCase()).filter(Boolean))];
    if (flags.some(flag => !["WKO", "HST"].includes(flag))) throw new Error("Unrecognized work-order record flag: " + flags.join(", ") + ". Please share the work-order link for this record.");
    if (flags.length !== 1) throw new Error("Unable to verify a single work-order flag. Refresh the record and reopen the email dialog.");
    const flag = flags[0];
    return { id, key, obj, flag, link: `${location.origin}/#/main/fal/WorkOrderRecords/${key}?Flag=${flag}` };
  }

  window.MPulseWorkOrderEmailDiagnostics = function () {
    let result;
    try {
      const record = resolveRecord();
      result = { version: SCRIPT_VERSION, displayedId: record.id, recordKey: record.key, recordFlag: record.flag, generatedUrl: record.link };
    } catch (error) { result = { version: SCRIPT_VERSION, displayedId: visibleRecordId(), error: error.message }; }
    console.log(JSON.stringify(result, null, 2));
    return result;
  };

  function normalizeText(value) {
    if (value == null) return "";

    if (typeof value === "object") {
      const text =
        value.Desc ??
        value.Description ??
        value.Value ??
        value.Name ??
        "";
      return String(text).replace(/\s+/g, " ").trim();
    }

    return String(value).replace(/\s+/g, " ").trim();
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getText(selectors) {
    for (const selector of selectors) {
      const nodes = visibleNodes(selector);
      if (nodes.length !== 1) continue;
      const text = normalizeText(nodes[0].value || nodes[0].innerText || nodes[0].textContent);
      if (text) return text;
    }
    return "";
  }

  function gridNames(selector) {
    try {
      const nodes = visibleNodes(selector);
      if (nodes.length !== 1) return [];
      const rows = window.DevExpress?.ui?.dxDataGrid?.getInstance(nodes[0])?.getDataSource()?.items?.() || [];
      return rows.map(row => normalizeText(row.Description || row.AssetDesc || row.EquipmentDesc || row.EmployeeDesc || row.PersonnelDesc || row.Code)).filter(Boolean);
    } catch { return []; }
  }

  function getWorkOrderData() {
    const record = resolveRecord();
    return {
      id: record.id, key: record.key, link: record.link,
      description: getText(["#Description", "#EQUDescription"]) || normalizeText(record.obj.RecordDescription),
      status: getText(["#StatusDesc"]) || normalizeText(record.obj.StatusDesc),
      dateOpened: getText(["#Open"]), dateDue: getText(["#Due"]),
      assets: gridNames("#AssetList"), personnel: gridNames("#PersonalList")
    };
  }

  function getTemplateContent(templateKey) {
    return TEMPLATE_OPTIONS.find(item => item.key === templateKey) || TEMPLATE_OPTIONS[0];
  }

  function buildSubject(templateKey, data) {
    const template = getTemplateContent(templateKey);
    return [template.subjectPrefix, data.id && `Work order ${normalizeText(data.id)}`,
      normalizeText(data.description)].filter(Boolean).join(" - ");
  }

  function buildSummaryLines(data) {
    return [
      `Work Order: ${data.id}`,
      data.status ? `Status: ${data.status}` : "",
      data.description ? `Description: ${data.description}` : "",
      data.dateOpened ? `Date Opened: ${data.dateOpened}` : "",
      data.dateDue ? `Date Due: ${data.dateDue}` : "",
      data.personnel.length ? `Assigned Personnel: ${data.personnel.join(", ")}` : ""
    ].filter(Boolean);
  }

  function buildPlainTextBody(templateKey, userContext, data) {
    const template = getTemplateContent(templateKey);
    return [
      "Hello,", template.action,
      userContext.trim(),
      buildSummaryLines(data).join("\n"),
      data.assets.length ? "Associated assets:\n" + data.assets.join("\n") : "",
      "Open work order:\n" + data.link,
      "Thank you."
    ].filter(Boolean).join("\n\n");
  }

  function buildHtmlBody(templateKey, userContext, data) {
    const template = getTemplateContent(templateKey);
    const multiline = value => escapeHtml(value).replace(/\r?\n/g, "<br>");
    const rows = buildSummaryLines(data).map(line => {
      const idx = line.indexOf(":");
      return `<tr><td style="padding:4px 12px 4px 0;vertical-align:top;font-weight:bold;">${escapeHtml(line.slice(0, idx))}</td><td style="padding:4px 0;">${escapeHtml(line.slice(idx + 1).trim())}</td></tr>`;
    }).join("");
    return `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#222;">
      <p>Hello,</p><p>${escapeHtml(template.action)}</p>
      ${userContext.trim() ? `<p>${multiline(userContext.trim())}</p>` : ""}
      <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${rows}</table>
      ${data.assets.length ? `<p><b>Associated assets</b><br>${data.assets.map(multiline).join("<br>")}</p>` : ""}
      <p><a href="${escapeHtml(data.link)}">Open work order${data.id ? " " + escapeHtml(data.id) : ""}</a></p>
      <p>Thank you.</p></div>`;
  }

  function getDraft(modal) {
    const current = resolveRecord();
    if (current.id !== modal.workOrderData.id || current.key !== modal.workOrderData.key || current.link !== modal.workOrderData.link) {
      throw new Error("The selected work order changed. Close and reopen the email dialog for the current work order.");
    }
    const data = modal.workOrderData;
    const key = modal.dataset.selectedTemplate || "information";
    const context = modal.querySelector("#workOrderContextInput").value.trim();
    if (key === "information" && !context) throw new Error("List the information needed in Additional context.");
    return { subject: buildSubject(key, data), plain: buildPlainTextBody(key, context, data), html: buildHtmlBody(key, context, data) };
  }

  function openOutlookDraft(modal) {
    const draft = getDraft(modal);
    const params = [];
    if (DEFAULT_TO) params.push("to=" + encodeURIComponent(DEFAULT_TO));
    if (DEFAULT_CC) params.push("cc=" + encodeURIComponent(DEFAULT_CC));
    params.push("subject=" + encodeURIComponent(draft.subject));
    params.push("body=" + encodeURIComponent(draft.plain));
    const url = "https://outlook.office.com/mail/deeplink/compose?" + params.join("&");
    if (url.length > 7500) throw new Error("This draft is too long for a reliable compose link. Use Copy Subject and Copy Body instead.");
    const opened = window.open(url, "_blank");
    if (!opened) throw new Error("The browser blocked the Outlook window. Allow popups or use the copy buttons.");
    try { opened.opener = null; } catch { /* Cross-origin browser restriction. */ }
    showModalStatus("Outlook opened with the subject and plain-text body. Review before sending.", false);
  }

  async function copyText(text) {
    if (navigator.clipboard?.writeText) {
      try { await navigator.clipboard.writeText(text); return; } catch { /* Try legacy copy. */ }
    }
    const input = document.createElement("textarea");
    input.value = text;
    input.style.cssText = "position:fixed;left:-9999px;top:0;";
    const focused = document.activeElement;
    document.body.appendChild(input);
    input.select();
    try {
      if (!document.execCommand("copy")) throw new Error("Clipboard unavailable. Try Draft Email to open the message in Outlook.");
    } finally { input.remove(); focused?.focus(); }
  }

  async function copyFormattedEmail(modal) {
    const draft = getDraft(modal);
    if (navigator.clipboard?.write && window.ClipboardItem) {
      try {
        await navigator.clipboard.write([new ClipboardItem({
          "text/plain": new Blob([draft.plain], { type: "text/plain" }),
          "text/html": new Blob([draft.html], { type: "text/html" })
        })]);
        return true;
      } catch { /* Rich clipboard may be denied even when the API exists. */ }
    }
    await copyText(draft.plain);
    return false;
  }

  function removeModal() {
    document.getElementById(MODAL_ID)?.remove();
    document.getElementById(OVERLAY_ID)?.remove();
  }

  function showModalStatus(message, isError) {
    const statusEl = document.querySelector("#workOrderEmailModalStatus");
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.style.color = isError ? "#c62828" : "#2e7d32";
  }

  function applyTemplateSelection(modal, templateKey) {
    const template = getTemplateContent(templateKey);
    modal.dataset.selectedTemplate = templateKey;

    modal.querySelector("#workOrderTemplateSelect").value = templateKey;

    const context = modal.querySelector("#workOrderContextInput");
    context.placeholder = templateKey === "information" ? "List the missing details or questions you need answered..." :
      "Add any details for the recipient (optional)...";
    showModalStatus("Draft Email opens Outlook with plain text. Copy Body preserves formatting; copy the subject separately.", false);
  }

  function createModal() {
    let snapshot;
    try { snapshot = getWorkOrderData(); }
    catch (error) { window.alert(error.message); return; }
    removeModal();

    const overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.background = "rgba(0,0,0,0.35)";
    overlay.style.zIndex = "99998";

    const modal = document.createElement("div");
    modal.id = MODAL_ID;
    modal.workOrderData = snapshot;
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-label", "Work Order Email");
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
        <div style="font-size:16px; font-weight:bold;">Work Order Email</div>
        <button type="button" id="workOrderModalCloseBtn" style="border:none; background:transparent; font-size:20px; cursor:pointer; line-height:1;">×</button>
      </div>

      <label for="workOrderTemplateSelect" style="display:block;font-size:13px;margin-bottom:8px;font-weight:bold;">Template</label>
      <select id="workOrderTemplateSelect" style="width:100%;box-sizing:border-box;padding:10px;border:1px solid #cfd8dc;border-radius:6px;background:#fff;margin-bottom:14px;font-size:13px;">
        ${TEMPLATE_OPTIONS.map(opt => `<option value="${opt.key}">${opt.label}</option>`).join("")}
      </select>

      <div style="font-size:13px; margin-bottom:8px; font-weight:bold;">Additional context</div>
      <textarea
        id="workOrderContextInput"
        style="width:100%; min-height:110px; resize:vertical; border:1px solid #cfd8dc; border-radius:6px; padding:10px; font-family:Arial, sans-serif; font-size:13px; box-sizing:border-box;"
      ></textarea>

      <div id="workOrderEmailModalStatus" style="margin-top:10px; font-size:12px; color:#2e7d32;">
        Tip: Copy Formatted Email and paste into Outlook for a clickable link and richer formatting.
      </div>

      <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:14px; flex-wrap:wrap;">
        <button
          type="button"
          id="workOrderModalCancelBtn"
          style="padding:8px 12px; border:1px solid #cfd8dc; border-radius:6px; background:#fff; cursor:pointer; font-size:13px;"
        >Cancel</button>

        <button
          type="button"
          id="workOrderModalCopyBtn"
          style="padding:8px 12px; border:1px solid #2e7d32; border-radius:6px; background:#388e3c; color:#fff; cursor:pointer; font-size:13px;"
        >Copy Body</button>
        <button type="button" id="workOrderModalSubjectBtn" style="padding:8px 12px;border:1px solid #cfd8dc;border-radius:6px;background:#fff;cursor:pointer;">Copy Subject</button>

        <button
          type="button"
          id="workOrderModalDraftBtn"
          style="padding:8px 12px; border:1px solid #1565c0; border-radius:6px; background:#1976d2; color:#fff; cursor:pointer; font-size:13px;"
        >Draft Email</button>
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(modal);

    modal.addEventListener("keydown", event => { if (event.key === "Escape") removeModal(); });
    const contextInput = modal.querySelector("#workOrderContextInput");

    modal.querySelector("#workOrderTemplateSelect").addEventListener("change", function () {
      applyTemplateSelection(modal, this.value);
    });

    function closeModal() {
      removeModal();
    }

    overlay.addEventListener("click", closeModal);
    modal.querySelector("#workOrderModalCloseBtn").addEventListener("click", closeModal);
    modal.querySelector("#workOrderModalCancelBtn").addEventListener("click", closeModal);

    modal.querySelector("#workOrderModalDraftBtn").addEventListener("click", () => {
      try { openOutlookDraft(modal); }
      catch (err) { showModalStatus(err.message, true); }
    });
    modal.querySelector("#workOrderModalSubjectBtn").addEventListener("click", async () => {
      try {
        await copyText(getDraft(modal).subject);
        showModalStatus("Subject copied. Paste it into the email subject field.", false);
      } catch (err) { showModalStatus(err.message, true); }
    });
    modal.querySelector("#workOrderModalCopyBtn").addEventListener("click", async () => {
      try {
        const rich = await copyFormattedEmail(modal);
        showModalStatus(rich ? "Formatted body copied. Paste into the email body; use Copy Subject separately." : "Plain-text body copied. Use Copy Subject separately.", false);
      } catch (err) { showModalStatus(err.message, true); }
    });

    applyTemplateSelection(modal, "information");
    contextInput.focus();
  }

  function createButton() {
    const button = document.createElement("button");
    button.type = "button";
    button.id = BUTTON_ID;
    button.title = BUTTON_TITLE;
    button.setAttribute("aria-label", BUTTON_TITLE);
    button.innerHTML = `<i class="fa fa-paper-plane" aria-hidden="true"></i>`;

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

    log("Work order email button injected");
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
