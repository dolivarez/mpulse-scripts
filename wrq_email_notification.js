(function () {
  const SCRIPT_VERSION = "1.1.6";
  const BUTTON_ID = "toolbarMaintenanceRequestEmailButton";
  const BUTTON_TITLE = "Draft maintenance request email / copy formatted email";
  const ACTION_MENU_SELECTOR = ".action-menu-items ul.itemDetailActionBtns";

  const DEFAULT_TO = "";
  const DEFAULT_CC = "";

  const MODAL_ID = "toolbarMaintenanceRequestEmailModal";
  const OVERLAY_ID = "toolbarMaintenanceRequestEmailOverlay";

  // Request route: WorkRequestRecords/{RecordKey}; flags WKRQST (active) / WKRQSTHST (history).
  // Use the internal RecordKey, never the displayed maintenance request ID.
  const TEMPLATE_OPTIONS = [
    { key: "information", label: "Information requested", subjectPrefix: "Information requested", action: "Please provide the additional information listed below so we can evaluate this maintenance request and determine the next steps." },
    { key: "general", label: "General review", subjectPrefix: "Review requested", action: "Please review this maintenance request and advise on next steps." },
    { key: "conversion", label: "Routing / conversion", subjectPrefix: "Routing review requested", action: "Please review this maintenance request and confirm the appropriate assignment or conversion to a work order." }
  ];

  function log(...args) {
    console.log(`[${BUTTON_ID} v${SCRIPT_VERSION}]`, ...args);
  }

  function visibleRecordId() {
    const nodes = document.querySelectorAll("#ID, #REQID, #WRQID");
    for (const node of nodes) {
      if (!node.getClientRects().length) continue;
      const value = normalizeText(node.value || node.textContent);
      if (value) return value;
    }
    return getDisplayValueByLabel("ID#") || getDisplayValueByLabel("ID #") || "";
  }

  function objectRecordId(obj) {
    return normalizeText(obj?.RecordId ?? obj?.RequestID ?? obj?.WorkRequestID ?? obj?.MRID ?? obj?.RecordID);
  }

  // Resolve from the displayed form first; the body scope can retain an earlier selection.
  function getRequestObj() {
    try {
      const id = visibleRecordId();
      const route = parseRequestUrl(location.href);
      const candidates = [];
      const seen = new Set();
      const nodes = [...document.querySelectorAll("#ID, #REQID, #WRQID, #Description, .ng-scope, " + ACTION_MENU_SELECTOR)]
        .filter(node => node.getClientRects().length);
      nodes.push(document.body);
      for (const node of nodes) {
        let scope = window.angular?.element(node).scope();
        for (let depth = 0; scope && depth < 12 && !seen.has(scope); depth++, scope = scope.$parent) {
          seen.add(scope);
          for (const obj of [scope.selectedRecord, scope.SelectedObject, scope.listviewlayouts?.SelectedObject]) {
            if (obj && !candidates.includes(obj)) candidates.push(obj);
          }
        }
      }
      // Never use a selection whose displayed request ID belongs to a different record.
      if (id) return candidates.find(obj => objectRecordId(obj) === id) || null;
      if (route) return candidates.find(obj => String(obj.RecordKey ?? obj.recordKey ?? obj.SelectedRecordKey) === route.key) || null;
      return candidates[0] || null;
    } catch { return null; }
  }


  window.MPulseRequestEmailDiagnostics = function () {
    const obj = getRequestObj();
    const result = {
      version: SCRIPT_VERSION,
      displayedId: visibleRecordId(),
      resolved: obj ? { RecordId: obj.RecordId, RecordKey: obj.RecordKey,
        RecordFlag: obj.RecordFlag, RequestStatusDesc: obj.RequestStatusDesc } : null,
      generatedUrl: buildRequestUrl()
    };
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

  function cleanLookup(value) {
    if (!value) return "";

    if (typeof value === "object") {
      const desc = value.Desc ?? value.Description ?? value.Value ?? "";
      const key = value.Key ?? value.key ?? "";
      const cleanedDesc = String(desc || "").trim();
      const cleanedKey = String(key || "").trim();

      if (!cleanedDesc || cleanedDesc === "ID #Description" || cleanedDesc === "-999") {
        return cleanedKey === "-999" ? "" : "";
      }

      return cleanedDesc;
    }

    const text = String(value).trim();
    if (!text || text === "ID #Description" || text === "-999") return "";
    return text;
  }

  function formatDateOnly(value) {
    if (!value) return "";

    try {
      const dateOnly = String(value).match(/^(\d{4})-(\d{2})-(\d{2})(?:T00:00:00(?:\.0+)?Z?)?$/);
      if (dateOnly) return `${Number(dateOnly[2])}/${Number(dateOnly[3])}/${dateOnly[1]}`;
      const d = new Date(value);
      if (isNaN(d)) return String(value).split("T")[0];
      return d.toLocaleDateString("en-US");
    } catch {
      return String(value).split("T")[0];
    }
  }

  function getText(selectors) {
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (!el) continue;

      const txt = normalizeText(el.value || el.innerText || el.textContent || "");
      if (txt) return txt;
    }
    return "";
  }

  function getDisplayValueByLabel(labelText) {
    const wanted = normalizeText(labelText).toLowerCase();
    const labelNodes = Array.from(
      document.querySelectorAll("label, .dx-field-item-label-text, .fal-form-label, .form-group label, .control-label")
    );

    for (const labelNode of labelNodes) {
      const txt = normalizeText(labelNode.textContent || "");
      if (!txt || txt.toLowerCase() !== wanted) continue;

      const container =
        labelNode.closest(".dx-field-item, .form-group, td, tr, .row") ||
        labelNode.parentElement;

      if (!container) continue;

      const linkedText = Array.from(container.querySelectorAll("a"))
        .map(a => normalizeText(a.textContent || ""))
        .find(Boolean);
      if (linkedText) return linkedText;

      const dxDisplay =
        container.querySelector(".dx-texteditor-input") ||
        container.querySelector(".dx-dropdowneditor-input-wrapper input") ||
        container.querySelector(".dx-selectbox .dx-texteditor-input") ||
        container.querySelector(".dx-tag-content") ||
        container.querySelector(".dx-textbox input");

      if (dxDisplay) {
        const displayVal = normalizeText(dxDisplay.value || dxDisplay.textContent || "");
        if (displayVal) return displayVal;
      }

      const visibleText = Array.from(container.querySelectorAll("span, div"))
        .map(el => normalizeText(el.textContent || ""))
        .find(v => v && v.toLowerCase() !== wanted);
      if (visibleText) return visibleText;

      const rawInput = container.querySelector("input, textarea, select");
      if (rawInput) {
        const rawVal = normalizeText(rawInput.value || rawInput.textContent || "");
        if (rawVal) return rawVal;
      }
    }

    return "";
  }

  function getRecordId() {
    const obj = getRequestObj();
    return (
      obj?.RecordId ||
      obj?.RecordID ||
      obj?.RequestID ||
      obj?.WorkRequestID ||
      obj?.MRID ||
      getText(["#ID", "#REQID", "#WRQID", "[id='ID']"]) ||
      getDisplayValueByLabel("ID#")
    );
  }

  function getStatus() {
    const obj = getRequestObj();
    return (
      obj?.RequestStatusDesc ||
      obj?.StatusDesc ||
      obj?.RequestStatus?.Desc ||
      obj?.ReqStatus?.Desc ||
      getDisplayValueByLabel("Request Status") ||
      getDisplayValueByLabel("Status") ||
      getText(["#StatusDesc"])
    );
  }

  function getDescription() {
    const obj = getRequestObj();
    return (
      obj?.RecordDescription ||
      obj?.Description ||
      obj?.Desc ||
      getText(["#Description", "#REQDescription", "#WRQDescription"]) ||
      getDisplayValueByLabel("Description")
    );
  }

  function getRequestType() {
    const obj = getRequestObj();
    return cleanLookup(
      obj?.RequestType ||
      obj?.Type ||
      getDisplayValueByLabel("Request Type") ||
      getDisplayValueByLabel("Type") ||
      ""
    );
  }

  function getPriority() {
    const obj = getRequestObj();
    return cleanLookup(
      obj?.Priority ||
      obj?.PriorityDesc ||
      getDisplayValueByLabel("Priority") ||
      ""
    );
  }

  function getRequester() {
    const obj = getRequestObj();
    const cleaned = cleanLookup(
      obj?.Requestor ||
      obj?.Requester ||
      obj?.Employee ||
      obj?.EnteredBy ||
      getDisplayValueByLabel("Requester") ||
      getDisplayValueByLabel("Requested By") ||
      getDisplayValueByLabel("Employee") ||
      ""
    );
    return cleaned;
  }

  function getDepartment() {
    return cleanLookup(
      getRequestObj()?.Department ||
      getDisplayValueByLabel("Department") ||
      ""
    );
  }

  function getSystem() {
    return cleanLookup(
      getRequestObj()?.System ||
      getDisplayValueByLabel("System") ||
      ""
    );
  }

  function getSubsystem() {
    return cleanLookup(
      getRequestObj()?.Subsystem ||
      getDisplayValueByLabel("Subsystem") ||
      ""
    );
  }

  function getLocation() {
    return cleanLookup(
      getRequestObj()?.Location ||
      getDisplayValueByLabel("Location") ||
      getDisplayValueByLabel("Room") ||
      ""
    );
  }

  function getDateOpened() {
    const obj = getRequestObj();
    return (
      obj?.OpenDate ||
      obj?.DateOpened ||
      getDisplayValueByLabel("Date Opened") ||
      getText(["#Open"])
    );
  }

  function getDateDue() {
    const obj = getRequestObj();
    return (
      obj?.DueDate ||
      obj?.DateDue ||
      getDisplayValueByLabel("Date Due") ||
      getText(["#Due"])
    );
  }

  function getConvertedWorkOrder() {
    const obj = getRequestObj();
    return cleanLookup(
      obj?.WorkOrder ||
      obj?.ConvertedWorkOrder ||
      getDisplayValueByLabel("Work Order") ||
      getDisplayValueByLabel("Converted Work Order") ||
      ""
    );
  }

  function getAssetSummary() {
    const obj = getRequestObj();

    const singleAsset = cleanLookup(
      obj?.WKRQSTCADesc ||
      obj?.wkrqstcadesc ||
      obj?.WKRQSTCADesc ||
      ""
    );

    return singleAsset ? [singleAsset] : [];
  }

  function normalizeRequestFlag(value) {
    const flag = String(value ?? "").trim().toUpperCase();
    return flag === "WKRQST" || flag === "WKRQSTHST" ? flag : "";
  }

  function parseRequestUrl(value) {
    try {
      const url = new URL(String(value || "").trim());
      if (!/^https?:$/.test(url.protocol) || url.origin !== location.origin ||
          url.username || url.password) return null;
      const match = url.hash.match(/^#\/main\/fal\/(?:RequestRecords|MaintenanceRequestRecords|WorkRequestRecords)\/([1-9]\d*)(?:\?([^#]*))?$/i);
      if (!match) return null;
      const params = new URLSearchParams(match[2] || "");
      let flag = "";
      for (const [name, value] of params) {
        if (name.toLowerCase() === "flag") flag = normalizeRequestFlag(value);
      }
      return { key: match[1], flag };
    } catch { return null; }
  }

  function canonicalRequestUrl(recordKey, flag) {
    const key = String(recordKey ?? "").trim();
    const validFlag = normalizeRequestFlag(flag);
    if (!/^[1-9]\d*$/.test(key) || !validFlag) return "";
    return `${location.origin}/#/main/fal/WorkRequestRecords/${key}?Flag=${validFlag}`;
  }

  function validateRecordUrl(value) {
    const parsed = parseRequestUrl(value);
    return parsed ? canonicalRequestUrl(parsed.key, parsed.flag) : "";
  }

  function getRequestFlag(recordKey, obj, currentRoute) {
    const recordFlag = normalizeRequestFlag(obj?.RecordFlag);
    if (recordFlag) return recordFlag;
    if (currentRoute?.key === String(recordKey).trim() && currentRoute.flag) {
      return currentRoute.flag;
    }

    // Exact conversion statuses only: "Not converted" must not match.
    const status = normalizeText(getStatus()).toLowerCase();
    if (/^(converted|converted to (a )?work order)$/.test(status)) return "WKRQSTHST";
    // A recognizable work-order ID is stronger evidence than a nonempty lookup placeholder.
    const workOrder = normalizeText(getConvertedWorkOrder());
    if (/\bWKO-\d+\b/i.test(workOrder)) return "WKRQSTHST";

    // Preserve the existing active default. Other history statuses are not inferred.
    return "WKRQST";
  }

  function buildRequestUrl() {
    const obj = getRequestObj();
    const currentRoute = parseRequestUrl(location.href);
    const selectedKey = obj?.RecordKey ?? obj?.recordKey ?? obj?.SelectedRecordKey;
    const hasSelectedKey = selectedKey != null && String(selectedKey).trim() !== "";
    const key = hasSelectedKey ? selectedKey : currentRoute?.key;
    const displayedId = visibleRecordId();
    // Do not infer a popup identity from a parent page URL or unmatched selection.
    if (!displayedId || !hasSelectedKey || objectRecordId(obj) !== displayedId) return "";
    return canonicalRequestUrl(key, getRequestFlag(key, obj, currentRoute));
  }

  function getRequestData() {
    return {
      id: getRecordId(),
      status: getStatus(),
      description: getDescription(),
      requestType: getRequestType(),
      priority: getPriority(),
      requester: getRequester(),
      department: getDepartment(),
      system: getSystem(),
      subsystem: getSubsystem(),
      location: getLocation(),
      dateOpened: formatDateOnly(getDateOpened()),
      dateDue: formatDateOnly(getDateDue()),
      convertedWorkOrder: getConvertedWorkOrder(),
      assets: getAssetSummary(),
      
      link: buildRequestUrl()
    };
  }

  function getTemplateContent(templateKey) {
    return TEMPLATE_OPTIONS.find(item => item.key === templateKey) || TEMPLATE_OPTIONS[0];
  }

  function buildSubject(templateKey, data) {
    const template = getTemplateContent(templateKey);
    return [template.subjectPrefix, data.id && `Maintenance request ${normalizeText(data.id)}`,
      normalizeText(data.description)].filter(Boolean).join(" - ");
  }

  function buildSummaryLines(data) {
    return [
      `Maintenance Request: ${data.id || "[Unavailable]"}`,
      data.status ? `Status: ${data.status}` : "",
      data.description ? `Description: ${data.description}` : "",
      data.requestType ? `Request Type: ${data.requestType}` : "",
      data.priority ? `Priority: ${data.priority}` : "",
      data.requester ? `Requester: ${data.requester}` : "",
      data.department ? `Department: ${data.department}` : "",
      data.system ? `System: ${data.system}` : "",
      data.subsystem ? `Subsystem: ${data.subsystem}` : "",
      data.location ? `Location: ${data.location}` : "",
      data.dateOpened ? `Date Opened: ${data.dateOpened}` : "",
      data.dateDue ? `Date Due: ${data.dateDue}` : "",
      data.convertedWorkOrder ? `Converted Work Order: ${data.convertedWorkOrder}` : ""
    ].filter(Boolean);
  }

  function buildPlainTextBody(templateKey, userContext, data) {
    const template = getTemplateContent(templateKey);
    return [
      "Hello,", template.action,
      userContext.trim(),
      buildSummaryLines(data).join("\n"),
      data.assets.length ? "Associated assets:\n" + data.assets.join("\n") : "",
      "Open maintenance request:\n" + data.link,
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
      <p><a href="${escapeHtml(data.link)}">Open maintenance request${data.id ? " " + escapeHtml(data.id) : ""}</a></p>
      <p>Thank you.</p></div>`;
  }

  function getDraft(modal) {
    const currentId = visibleRecordId();
    if (currentId && modal.requestData.id && currentId !== normalizeText(modal.requestData.id)) {
      throw new Error("The selected request changed. Close and reopen the email dialog for the current request.");
    }
    const data = { ...modal.requestData, link: validateRecordUrl(modal.requestData.link) };
    if (!data.link) throw new Error("Unable to verify this request's internal key. Run MPulseRequestEmailDiagnostics() in the console and share the result.");
    const key = modal.dataset.selectedTemplate || "information";
    const context = modal.querySelector("#requestContextInput").value.trim();
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
    const statusEl = document.querySelector("#requestEmailModalStatus");
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.style.color = isError ? "#c62828" : "#2e7d32";
  }

  function applyTemplateSelection(modal, templateKey) {
    const template = getTemplateContent(templateKey);
    modal.dataset.selectedTemplate = templateKey;

    modal.querySelector("#requestTemplateSelect").value = templateKey;

    const context = modal.querySelector("#requestContextInput");
    context.placeholder = templateKey === "information" ? "List the missing details or questions you need answered..." :
      "Add any details for the recipient (optional)...";
    showModalStatus("Draft Email opens Outlook with plain text. Copy Body preserves formatting; copy the subject separately.", false);
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
    modal.requestData = getRequestData();
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-label", "Maintenance Request Email");
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
        <div style="font-size:16px; font-weight:bold;">Maintenance Request Email</div>
        <button type="button" id="requestModalCloseBtn" style="border:none; background:transparent; font-size:20px; cursor:pointer; line-height:1;">×</button>
      </div>

      <label for="requestTemplateSelect" style="display:block;font-size:13px;margin-bottom:8px;font-weight:bold;">Template</label>
      <select id="requestTemplateSelect" style="width:100%;box-sizing:border-box;padding:10px;border:1px solid #cfd8dc;border-radius:6px;background:#fff;margin-bottom:14px;font-size:13px;">
        ${TEMPLATE_OPTIONS.map(opt => `<option value="${opt.key}">${opt.label}</option>`).join("")}
      </select>

      <div style="font-size:13px; margin-bottom:8px; font-weight:bold;">Additional context</div>
      <textarea
        id="requestContextInput"
        style="width:100%; min-height:110px; resize:vertical; border:1px solid #cfd8dc; border-radius:6px; padding:10px; font-family:Arial, sans-serif; font-size:13px; box-sizing:border-box;"
      ></textarea>

      <div id="requestEmailModalStatus" style="margin-top:10px; font-size:12px; color:#2e7d32;">
        Tip: Copy Formatted Email and paste into Outlook for a clickable link and richer formatting.
      </div>

      <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:14px; flex-wrap:wrap;">
        <button
          type="button"
          id="requestModalCancelBtn"
          style="padding:8px 12px; border:1px solid #cfd8dc; border-radius:6px; background:#fff; cursor:pointer; font-size:13px;"
        >Cancel</button>

        <button
          type="button"
          id="requestModalCopyBtn"
          style="padding:8px 12px; border:1px solid #2e7d32; border-radius:6px; background:#388e3c; color:#fff; cursor:pointer; font-size:13px;"
        >Copy Body</button>
        <button type="button" id="requestModalSubjectBtn" style="padding:8px 12px;border:1px solid #cfd8dc;border-radius:6px;background:#fff;cursor:pointer;">Copy Subject</button>

        <button
          type="button"
          id="requestModalDraftBtn"
          style="padding:8px 12px; border:1px solid #1565c0; border-radius:6px; background:#1976d2; color:#fff; cursor:pointer; font-size:13px;"
        >Draft Email</button>
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(modal);

    modal.addEventListener("keydown", event => { if (event.key === "Escape") removeModal(); });
    const contextInput = modal.querySelector("#requestContextInput");

    modal.querySelector("#requestTemplateSelect").addEventListener("change", function () {
      applyTemplateSelection(modal, this.value);
    });

    function closeModal() {
      removeModal();
    }

    overlay.addEventListener("click", closeModal);
    modal.querySelector("#requestModalCloseBtn").addEventListener("click", closeModal);
    modal.querySelector("#requestModalCancelBtn").addEventListener("click", closeModal);

    modal.querySelector("#requestModalDraftBtn").addEventListener("click", () => {
      try { openOutlookDraft(modal); }
      catch (err) { showModalStatus(err.message, true); }
    });
    modal.querySelector("#requestModalSubjectBtn").addEventListener("click", async () => {
      try {
        await copyText(buildSubject(modal.dataset.selectedTemplate, modal.requestData));
        showModalStatus("Subject copied. Paste it into the email subject field.", false);
      } catch (err) { showModalStatus(err.message, true); }
    });
    modal.querySelector("#requestModalCopyBtn").addEventListener("click", async () => {
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

    log("Maintenance request email button injected");
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
