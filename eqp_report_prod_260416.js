(function () {
  async function init() {
    console.log("📄 toolbarReportButton-EQP.js initialized");

    const norm = s => (s || '').replace(/\s+/g, ' ').trim();
    const getText = sel => {
      const el = document.querySelector(sel);
      if (!el) return '—';
      let text = el.innerText.trim();
      if (!text) {
        const input = el.querySelector('input,textarea,.dx-texteditor-input,.dx-textbox-input');
        if (input) text = input.value || input.textContent || '';
      }
      if (!text) {
        const val = el.querySelector('.dx-field-value,.dx-text-content-alignment-left');
        if (val) text = val.innerText.trim();
      }
      return text || '—';
    };

    const parseGrid = (rootSel, includeHeaders = true, filterCols = null) => {
      const root = document.querySelector(rootSel);
      if (!root) return { headers: [], rows: [] };

      const headersRaw = [...root.querySelectorAll(".dx-header-row td")];
      const headers = headersRaw.map(td => norm(td.innerText));

      const colIndexes = filterCols
        ? headers.map((h, i) => (filterCols.some(f => h.includes(f)) ? i : -1)).filter(i => i >= 0)
        : headers.map((_, i) => i);

      const rows = [...root.querySelectorAll(".dx-row:not(.dx-header-row):not(.dx-group-row)")].map(tr => {
        const cells = [...tr.querySelectorAll("td")];
        return colIndexes.map(i => norm(cells[i]?.innerText || ""));
      }).filter(r => r.some(cell => cell));

      return {
        headers: includeHeaders ? colIndexes.map(i => headers[i]) : [],
        rows
      };
    };

    const waitForToolbar = () => new Promise((resolve) => {
      const check = () => {
        const el = document.querySelector(".action-menu-items ul.itemDetailActionBtns");
        if (el) return resolve(el);
        requestAnimationFrame(check);
      };
      check();
    });

    const detectRecordType = () => {
      const el = document.querySelector(".module-name");
      return el?.textContent?.trim().toLowerCase() || "unknown";
    };

    const isEquipmentRecord = () => {
      const type = detectRecordType();
    
      // Primary check: module name
      if (type.includes("equipment")) return true;
    
      // Secondary safety check: equipment-only fields
      if (document.querySelector("#SerialNumber") || document.querySelector("#Model")) {
        return true;
      }
    
      return false;
  };


    function parseInventoryFromContext(ctx) {
        const list = ctx?.ListOfLinkedInventories || [];
      
        const rows = list.map(item => [
          item.Code || "—",
          item.Desc || "—"
        ]);
      
        return {
          headers: ["Inventory ID", "Description"],
          rows,
          count: rows.length
        };
      }






    function openViewsDropdown() {
      // This targets the Views dropdown button (caret icon)
      const btn = document.querySelector(
        '.itemDetailActionBtns a[title="Views"], ' +
        '.itemDetailActionBtns i.fa-caret-down'
      );
    
      if (!btn) return false;
    
      btn.click();
      return true;
    }


    const safeFilename = (s) =>
      (s || "Report")
        .toString()
        .replace(/[^\w\-]+/g, "_")   // remove illegal filename chars
        .replace(/_+/g, "_")         // collapse underscores
        .replace(/^_|_$/g, "");      // trim edges



    

    function findInScopeTree(scope, predicate, visited = new Set()) {
      if (!scope || visited.has(scope)) return null;
      visited.add(scope);
    
      try {
        if (predicate(scope)) return scope;
      } catch {}
    
      // Walk children
      let child = scope.$$childHead;
      while (child) {
        const found = findInScopeTree(child, predicate, visited);
        if (found) return found;
        child = child.$$nextSibling;
      }
    
      return null;
    }

    (function () {
      if (window.__MPULSE_FORMVIEW_CAPTURE_INSTALLED__) return;
      window.__MPULSE_FORMVIEW_CAPTURE_INSTALLED__ = true;
    
      const origOpen = XMLHttpRequest.prototype.open;
      const origSend = XMLHttpRequest.prototype.send;
    
      XMLHttpRequest.prototype.open = function (method, url, ...rest) {
        this.__url = url;
        return origOpen.call(this, method, url, ...rest);
      };
    
      XMLHttpRequest.prototype.send = function (...args) {
        this.addEventListener("load", function () {
          try {
            const url = this.__url || "";
            if (!/GetFormViewData/i.test(url)) return;
    
            const data = JSON.parse(this.responseText);
            window.__MPULSE_FORMVIEW__ = data;
          } catch (e) {
            console.warn("Failed to capture GetFormViewData", e);
          }
        });
    
        return origSend.apply(this, args);
      };
    })();


    (function () {
      if (window.__MPULSE_MOREVIEW_CAPTURE_INSTALLED__) return;
      window.__MPULSE_MOREVIEW_CAPTURE_INSTALLED__ = true;
    
      const origOpen = XMLHttpRequest.prototype.open;
      const origSend = XMLHttpRequest.prototype.send;
      const origSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
    
      XMLHttpRequest.prototype.open = function (method, url, ...rest) {
        this.__url = url;
        this.__method = method;
        this.__headers = {};
        return origOpen.call(this, method, url, ...rest);
      };
    
      XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
        this.__headers = this.__headers || {};
        this.__headers[name] = value;
        return origSetRequestHeader.call(this, name, value);
      };
    
      XMLHttpRequest.prototype.send = function (body) {
        if ((this.__url || "").includes("MoreViewClick")) {
          this.__body = body;
        }
    
        this.addEventListener("load", function () {
          try {
            const url = this.__url || "";
            if (!url.includes("MoreViewClick")) return;
    
            let parsedBody = this.__body;
            try { parsedBody = JSON.parse(this.__body); } catch {}
    
            let parsedResponse = this.responseText;
            try { parsedResponse = JSON.parse(this.responseText); } catch {}
    
            window.__LAST_MOREVIEW_REQUEST_FULL__ = {
              url,
              method: this.__method,
              body: parsedBody,
              headers: { ...(this.__headers || {}) }
            };
    
            window.__LAST_MOREVIEW_RESPONSE_FULL__ = parsedResponse;
            window.__LAST_MOREVIEW_RESPONSE__ = parsedResponse;
            window.__LAST_MOREVIEW_CLICK__ = parsedResponse;
    
            console.log("Captured MoreViewClick:", parsedResponse);
          } catch (e) {
            console.warn("Failed to capture MoreViewClick", e);
          }
        });
    
        return origSend.apply(this, arguments);
      };
    })();


function resolveFieldValue(v) {
  if (v == null || v === "") return "—";

  if (typeof v === "object") {
    if (v.Desc) return v.Desc;
    if (v.Description) return v.Description;
    if (v.Code) return v.Code;
    if ("Key" in v && v.Key === 0) return "—";
    return "—";
  }

  return String(v);
}

function formatBoolean(v) {
  if (v === true) return "Yes";
  if (v === false) return "No";
  return resolveFieldValue(v);
}

function formatDate(v) {
  if (!v || String(v).startsWith("0001-01-01")) return "—";
  const dt = new Date(v);
  if (Number.isNaN(dt.getTime())) return resolveFieldValue(v);
  return dt.toLocaleDateString();
}

function stripHtml(html) {
  if (!html) return "—";
  const div = document.createElement("div");
  div.innerHTML = html;
  const text = (div.textContent || div.innerText || "").trim();
  return text || "—";
}


  function normalizeSmrRows(raw) {
  if (!Array.isArray(raw)) return [];

  return raw.map(r => ({
    id: r.SMRCODE || "—",
    description: r.SMRDESC || "—",
    lastDone: formatDate(r.SMRLASTDONEDATE),
    nextDue: formatDate(r.SMRNEXTDATE),
    key: r.Key
  }));
}

async function fetchSmrDataDirect() {
  const req = window.__LAST_MOREVIEW_REQUEST_FULL__;
  const d = window.__MPULSE_FORMVIEW__ || {};

  if (!req?.url || !req?.body) return [];

  try {
    const headers = { ...(req.headers || {}) };

    const body = JSON.parse(JSON.stringify(req.body));

    // Refresh request context for the current equipment
    body.SubModuleName = "EquipmentRecords";
    body.SubModuleKey = 10;
    body.Token = String(d.Token || body.Token || "");
    body.Language = d.Language || body.Language || "en-US";

    if (typeof d.ClientTimeZoneOffSet !== "undefined") {
      body.ClientTimeZoneOffSet = d.ClientTimeZoneOffSet;
    }

    if (d.RecordKey || d.Recordkey) {
      body.RecordKey = d.RecordKey || d.Recordkey;
    }

    // Keep the current record context aligned
    if (body.DataObject && typeof body.DataObject === "object") {
      if (d.RecordKey || d.Recordkey) {
        body.DataObject.RecordKey = d.RecordKey || d.Recordkey;
        body.DataObject.Recordkey = d.RecordKey || d.Recordkey;
      }

      if (d.ID || d.EQCODE) {
        body.DataObject.ID = d.ID || d.EQCODE;
        body.DataObject.EQCODE = d.EQCODE || d.ID;
      }

      if (d.RecordDescription || d.Description) {
        body.DataObject.RecordDescription = d.RecordDescription || d.Description;
        body.DataObject.Description = d.Description || d.RecordDescription;
      }

      if (d.GenSnum) body.DataObject.GenSnum = d.GenSnum;
      if (d.LK_Mfr) body.DataObject.LK_Mfr = d.LK_Mfr;
      if (d.LK_EquModel) body.DataObject.LK_EquModel = d.LK_EquModel;
      if (d.Location) body.DataObject.Location = d.Location;
      if (d.System) body.DataObject.System = d.System;
      if (d.CustomField1) body.DataObject.CustomField1 = d.CustomField1;
    }

    const res = await fetch(req.url, {
      method: req.method || "POST",
      credentials: "include",
      headers,
      body: JSON.stringify(body)
    });

    const text = await res.text();
    if (!res.ok || !text) {
      console.warn("Direct SMR fetch failed", res.status, text);
      return [];
    }

    const data = JSON.parse(text);
    window.__LAST_MOREVIEW_RESPONSE_FULL__ = data;

    return normalizeSmrRows(data?.DataObject);
  } catch (e) {
    console.warn("Direct SMR fetch failed", e);
    return [];
  }
}


    async function openScheduledMaintenancePopup(timeout = 4000) {
      if (!openViewsDropdown()) return false;
    
      const menu = await new Promise(resolve => {
        const start = Date.now();
        const check = () => {
          const m = document.querySelector(
            '.itemDetailActionBtns ul li, .dx-overlay-content ul li'
          );
          if (m) return resolve(m.closest("ul"));
          if (Date.now() - start > timeout) return resolve(null);
          requestAnimationFrame(check);
        };
        check();
      });
    
      if (!menu) return false;
    
      const item = [...menu.querySelectorAll("li")]
        .find(li => li.innerText?.trim().startsWith("Maintenance Schedule"));
    
      if (!item) return false;
    
      item.click();
    
      return await new Promise(resolve => {
        const start = Date.now();
        const check = () => {
          const grid = document.querySelector(
            ".dx-popup-content #ScheduledMaintenanceList"
          );
          if (grid) return resolve(true);
          if (Date.now() - start > timeout) return resolve(false);
          requestAnimationFrame(check);
        };
        check();
      });
    }


    function getCurrentRecordKey() {
      const d = window.__MPULSE_FORMVIEW__ || {};
      return String(d.RecordKey || d.Recordkey || d.RecordID || d.ID || "");
    }
    
    function clearSmrCache() {
      window.__LAST_MOREVIEW_RESPONSE_FULL__ = null;
      window.__LAST_MOREVIEW_RESPONSE__ = null;
      window.__LAST_MOREVIEW_CLICK__ = null;
    }


    function smrMatchesCurrentRecord() {
      const d = window.__MPULSE_FORMVIEW__ || {};
      const currentId = String(d.ID || d.EQCODE || "");
      const resp = window.__LAST_MOREVIEW_RESPONSE_FULL__;
    
      if (!resp) return false;
    
      const respId =
        String(
          resp.RecordID ||
          resp.RecordId ||
          resp.EQCODE ||
          resp.ID ||
          ""
        );
    
      return !currentId || !respId ? false : currentId === respId;
    }
    
    async function ensureSmrLoaded() {
      let rows = [];
    
      if (smrMatchesCurrentRecord()) {
        rows = normalizeSmrRows(window.__LAST_MOREVIEW_RESPONSE_FULL__?.DataObject);
        if (rows.length) return rows;
      }
    
      rows = await fetchSmrDataDirect();
      if (rows.length) return rows;
    
      const opened = await openScheduledMaintenancePopup();
      if (!opened) return [];
    
      await new Promise(r => setTimeout(r, 300));
      document.querySelector(".dx-popup .dx-closebutton")?.click();
    
      return normalizeSmrRows(
        window.__LAST_MOREVIEW_RESPONSE_FULL__?.DataObject ||
        window.__LAST_MOREVIEW_RESPONSE__?.DataObject ||
        window.__LAST_MOREVIEW_CLICK__?.DataObject
      );
    }

    const REPORT_TYPES = {
      summary: {
        label: "Summary",
        sections: ["general", "smr"],
        filenameSuffix: "Summary"
      },
      operational: {
        label: "Operational",
        sections: ["general", "smr", "comments"],
        filenameSuffix: "Operational"
      },
      technical: {
        label: "Technical",
        sections: ["general", "inventory", "smr", "comments"],
        filenameSuffix: "Technical"
      },
      full: {
        label: "Full",
        sections: ["general", "inventory", "smr", "comments"],
        filenameSuffix: "Full"
      }
    };
    
    async function chooseReportType() {
      return new Promise(resolve => {
        const overlay = document.createElement("div");
        overlay.style.cssText = `
          position:fixed;
          inset:0;
          background:rgba(0,0,0,0.4);
          display:flex;
          align-items:center;
          justify-content:center;
          z-index:10000;
        `;
    
        const box = document.createElement("div");
        box.style.cssText = `
          background:#fff;
          padding:20px;
          border-radius:12px;
          min-width:320px;
          box-shadow:0 10px 30px rgba(0,0,0,0.25);
          font-family:Arial,sans-serif;
        `;
    
        box.innerHTML = `
          <h3 style="margin:0 0 12px 0;">Select Report Type</h3>
          <div style="display:flex;flex-direction:column;gap:8px;">
            <button data-type="summary" style="padding:10px;border-radius:8px;cursor:pointer;">Summary</button>
            <button data-type="operational" style="padding:10px;border-radius:8px;cursor:pointer;">Operational</button>
            <button data-type="technical" style="padding:10px;border-radius:8px;cursor:pointer;">Technical</button>
            <button data-type="full" style="padding:10px;border-radius:8px;cursor:pointer;">Full</button>
          </div>
          <div style="margin-top:10px;text-align:right;">
            <button id="cancelReportType" style="padding:8px 12px;border-radius:8px;cursor:pointer;">Cancel</button>
          </div>
        `;
    
        box.querySelectorAll("button[data-type]").forEach(btn => {
          btn.onclick = () => {
            const val = btn.getAttribute("data-type");
            overlay.remove();
            resolve(val);
          };
        });
    
        box.querySelector("#cancelReportType").onclick = () => {
          overlay.remove();
          resolve(null);
        };
    
        overlay.appendChild(box);
        document.body.appendChild(overlay);
      });
    }




    


    async function generateReport() {
      const type = detectRecordType();
    
      const d = window.__MPULSE_FORMVIEW__ || {};
      if (!window.__MPULSE_FORMVIEW__) {
        alert("Report data not ready yet. Please wait a moment and try again.");
        return;
      }
    
      const reportType = await chooseReportType();
      if (!reportType) return;
    
      const reportConfig = REPORT_TYPES[reportType] || REPORT_TYPES.full;
      const enabledSections = reportConfig.sections;
    
      const smrItems = await ensureSmrLoaded();

      const smrTable =
        smrItems.length
          ? {
              headers: ["SMR ID", "Description", "Last Done", "Next Due"],
              rows: smrItems.map(r => [
                r.id,
                r.description,
                r.lastDone,
                r.nextDue
              ])
            }
          : null;



      const linkedInventory = Array.isArray(d.ListOfLinkedInventories)
        ? d.ListOfLinkedInventories
        : [];
      
      const inventory = {
        headers: ["Inventory ID", "Description"],
        rows: linkedInventory.map(item => [
          item.Code || "—",
          item.Desc || item.Description || "—"
        ]),
        count: linkedInventory.length
      };
      
      const inventorySection = section(
        "Inventory",
        inventory.rows.length
          ? `
            <div style="margin-bottom:8px;font-weight:600;">
              Total Inventory Items: ${inventory.count}
            </div>
            ${tbl(inventory)}
          `
          : `<p style="color:#888;">No inventory linked</p>`
      );

    

      const data = {
        id: resolveFieldValue(d.EQCODE || d.ID || getText("#ID")),
        desc: resolveFieldValue(d.RecordDescription || getText("#EQUDescription")),
        in_service: formatBoolean(d.Inservice),
        manufacturer: resolveFieldValue(d.LK_Mfr),
        model: resolveFieldValue(d.LK_EquModel),
        sn: resolveFieldValue(d.GenSnum),
        eqp: resolveFieldValue(d.CustomField1),
        location: resolveFieldValue(d.Location),
        system: resolveFieldValue(d.System),
        department: resolveFieldValue(d.Department),
        warrantyExpiration: formatDate(d.WarrantyExpiration),
        comments: stripHtml(d.Comments)
      };




      const scheduledMaintenanceSection = smrTable
        ? section(
            "Scheduled Maintenance",
            `
              <div style="margin-bottom:8px;font-weight:600;">
                Total Scheduled Maintenance Items: ${smrItems.length}
              </div>
              ${tbl(smrTable)}
            `
          )
        : "";



      function section(title, content) {
        return `
          <h3 style="
            margin-top:20px;
            padding-bottom:6px;
            border-bottom:2px solid #0078d7;
          ">
            ${title}
          </h3>
          ${content}
        `;
      }

      

     

      function tbl({ headers, rows }) {
        if (!rows || !rows.length) return "<p>—</p>";
      
        return `
          <div style="overflow:auto;border:1px solid #ccc;border-radius:6px;margin-top:8px;">
            <table style="border-collapse:collapse;width:100%;font-size:12px;">
              ${headers && headers.length ? `
                <thead style="background:#f0f0f0;">
                  <tr>
                    ${headers.map(h => `
                      <th style="text-align:left;padding:6px;border-bottom:1px solid #ccc;">
                        ${h}
                      </th>
                    `).join("")}
                  </tr>
                </thead>
              ` : ""}
              <tbody>
                ${rows.map(r => `
                  <tr>
                    ${r.map(c => `
                      <td style="padding:6px;border-bottom:1px solid #eee;vertical-align:top;">
                        ${c}
                      </td>
                    `).join("")}
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        `;
      }



      const headerHTML = `
        <div style="
          display:flex;
          align-items:center;
          justify-content:space-between;
          border-bottom:2px solid #0078d7;
          padding-bottom:8px;
          margin-bottom:10px;
          gap:12px;
          width:100%;
          box-sizing:border-box;
        ">
          <div style="
            flex:0 0 140px;
            display:flex;
            align-items:center;
            justify-content:flex-start;
            min-width:140px;
          ">
            <img src="data:image/png;base64,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"
            style="height:52px; width:auto;">
          </div>
      
          <div style="
            flex:1 1 auto;
            text-align:center;
            min-width:0;
          ">
            <h2 style="
              margin:0;
              font-size:18px;
              line-height:1.2;
              white-space:nowrap;
            ">
              ${type.toUpperCase()} REPORT
            </h2>
            <!-- <div style="font-size:11px;color:#666;margin-top:2px;">
              MPulse CMMS
            </div> -->
          </div>
      
          <div style="
            flex:0 0 140px;
            display:flex;
            align-items:center;
            justify-content:flex-end;
            min-width:140px;
          ">
            <img
              src="https://mpulse9.com//Media/GetMenuImage?DBName=SOFIE&ImageType=LOGOLG&ImageName=Sofie%20Logo.png"
              style="height:24px;max-width:120px;object-fit:contain;"
            >
          </div>
        </div>
      `;


      const generalSection = `
        <div style="
          margin-top:12px;
          padding:10px;
          background:#f5f5f5;
          border-left:4px solid #0078d7;
          border-radius:4px;
        ">
          <strong>Description:</strong><br>
          ${data.desc}
        </div>
      
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <div><strong>ID:</strong> ${data.id}</div>
          <div><strong>Manufacturer:</strong> ${data.manufacturer}</div>
      
          <div><strong>Location:</strong> ${data.location}</div>
          <div><strong>Model:</strong> ${data.model}</div>
      
          <div><strong>System:</strong> ${data.system}</div>
          <div><strong>Serial Number:</strong> ${data.sn}</div>
      
          <div><strong>Department:</strong> ${data.department}</div>
          <div><strong>In Service:</strong> ${data.in_service}</div>
      
          <div><strong>EQP #:</strong> ${data.eqp}</div>
          <div><strong>Warranty Expiration:</strong> ${data.warrantyExpiration}</div>
        </div>
      `;



      const box = document.createElement("div");
box.id = "reportBox";
box.style.cssText = `
  background:white;
  width:90%;
  max-width:950px;
  max-height:90vh;
  overflow-y:auto;
  padding:24px;
  border-radius:12px;
  position:relative;
`;



     const sectionHtml = {
      general: `
        <div id="generalSection">
          ${section("General", generalSection)}
        </div>
      `,
      smr: scheduledMaintenanceSection
        ? `
          <div id="smrSection">
            ${scheduledMaintenanceSection}
          </div>
        `
        : "",
      inventory: inventorySection
        ? `
          <div id="inventorySection">
            ${inventorySection}
          </div>
        `
        : "",
      comments: `
        <div id="commentsSection">
         ${section(
            "Comments",
            `<div style="border:1px solid #ccc;border-radius:6px;padding:10px;white-space:pre-wrap;line-height:1.4;">
              ${data.comments}
            </div>`
          )}
        </div>
      `
    };
    
    const reportBody = `
      <div id="reportHeader">
        ${headerHTML}
        <div style="font-size:11px;color:#666;margin-top:4px;">
          Report Type: ${reportConfig.label}
        </div>
      </div>
    
      ${enabledSections.map(name => sectionHtml[name] || "").join("")}
    `;



      const overlay = document.createElement("div");
overlay.id = "reportOverlay";
overlay.style = `
  position:fixed;
  inset:0;
  background:rgba(0,0,0,0.5);
  z-index:9999;
  display:flex;
  justify-content:center;
  align-items:center;
`;

/* OUTER SHELL */
const shell = document.createElement("div");
shell.id = "reportShell";
shell.style = `
  background:#fff;
  width:90%;
  max-width:950px;
  max-height:90vh;
  display:flex;
  flex-direction:column;
  border-radius:12px;
`;

/* FIXED CONTROLS (TOP) */
const controls = document.createElement("div");
controls.id = "reportControls";
controls.style = `
  flex:0 0 auto;
  padding:12px 16px;
  border-bottom:1px solid #ccc;
  display:flex;
  justify-content:flex-end;
  gap:8px;
  background:#fff;
`;

controls.innerHTML = `
  <button id="downloadPdf"
    style="background:#0078d7;color:white;border:none;
           padding:8px 16px;border-radius:6px;cursor:pointer;">
    Download PDF
  </button>
  <button id="closeReport"
    style="padding:8px 16px;border-radius:6px;cursor:pointer;">
    Close
  </button>
`;

/* SCROLLABLE CONTENT */
const content = document.createElement("div");
content.id = "reportContent";
content.style = `
  flex:1 1 auto;
  overflow-y:auto;
  padding:24px;
`;
content.innerHTML = reportBody;

/* ASSEMBLE */
shell.appendChild(controls);
shell.appendChild(content);
overlay.appendChild(shell);
document.body.appendChild(overlay);

/* CLOSE HANDLER */
document.getElementById("closeReport").onclick = () => {
  overlay.remove();
  document.body.style.overflow = "";
};



      // Load jsPDF + html2canvas from GitHub (no CSP violation)
      if (!window.jspdf || !window.html2canvas) {
        await new Promise((res) => {
          const sc = document.createElement("script");
          sc.src = "https://cdn.jsdelivr.net/gh/dolivarez/mpulse-scripts/html2canvas.min.js";
          sc.onload = res;
          document.head.appendChild(sc);
        });

        await new Promise((res) => {
          const sc = document.createElement("script");
          sc.src = "https://cdn.jsdelivr.net/gh/dolivarez/mpulse-scripts/jspdf.umd.min.js";
          sc.onload = res;
          document.head.appendChild(sc);
        });
      }

function drawPdfFooter(pdf, pageWidth, pageHeight, pageNum, totalPages) {
  pdf.setFontSize(9);
  pdf.setTextColor(120);
  pdf.text(
    `Page ${pageNum} of ${totalPages}`,
    pageWidth / 2,
    pageHeight - 10,
    { align: "center" }
  );
}

      

      // PDF generation
     document.getElementById("downloadPdf").onclick = async () => {
      const content = document.getElementById("reportContent");
      if (!content) return;
    
      const reportCreatedAtText = new Date().toLocaleString();
    
      // Save original styles
      const originalBodyOverflow = document.body.style.overflow;
      const originalOverflow = content.style.overflow;
      const originalMaxHeight = content.style.maxHeight;
      const originalWidth = content.style.width;
      const originalMaxWidth = content.style.maxWidth;
      const originalMargin = content.style.margin;
      const originalPadding = content.style.padding;
      const originalBoxSizing = content.style.boxSizing;
      const originalBackground = content.style.background;
    
      // Force desktop/print layout even on mobile
      document.body.style.overflow = "hidden";
      content.style.overflow = "visible";
      content.style.maxHeight = "none";
      content.style.width = "794px";
      content.style.maxWidth = "794px";
      content.style.margin = "0 auto";
      content.style.padding = "24px";
      content.style.boxSizing = "border-box";
      content.style.background = "#ffffff";
    
      await new Promise(r => setTimeout(r, 100));
    
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF("p", "mm", "a4");
    
      const pageWidth = 210;
      const pageHeight = 297;
      const topMargin = 10;
      const bottomMargin = 14;
      const usableHeight = pageHeight - topMargin - bottomMargin;
    
      const canvas = await html2canvas(content, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        windowWidth: 794,
        width: 794,
        scrollX: 0,
        scrollY: 0
      });
    
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
      let yOffset = 0;
      let pageNum = 1;
    
      while (yOffset < imgHeight - 1) {
        if (pageNum > 1) pdf.addPage();
    
        const sourceY = (yOffset * canvas.width) / imgWidth;
        const sliceHeightPx = Math.min(
          canvas.height - sourceY,
          (usableHeight * canvas.width) / imgWidth
        );
    
        if (sliceHeightPx <= 2) break;
    
        const sliceCanvas = document.createElement("canvas");
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = sliceHeightPx;
    
        const ctx = sliceCanvas.getContext("2d");
        ctx.drawImage(
          canvas,
          0,
          sourceY,
          canvas.width,
          sliceHeightPx,
          0,
          0,
          canvas.width,
          sliceHeightPx
        );
    
        const sliceImg = sliceCanvas.toDataURL("image/png");
        const sliceHeightMm = (sliceCanvas.height * imgWidth) / sliceCanvas.width;
    
        pdf.addImage(sliceImg, "PNG", 0, topMargin, imgWidth, sliceHeightMm);
    
        yOffset += usableHeight;
        pageNum++;
      }
    
      const totalPages = pdf.getNumberOfPages();
    
      // Footer only
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
    
        pdf.setFontSize(8);
        pdf.setTextColor(120);
    
        pdf.text(
          `Report created: ${reportCreatedAtText}`,
          10,
          pageHeight - 8
        );
    
        pdf.text(
          `Page ${i} of ${totalPages}`,
          pageWidth - 10,
          pageHeight - 8,
          { align: "right" }
        );
      }
    
      pdf.save(`${safeFilename(data.id)}_${reportConfig.filenameSuffix}.pdf`);
    
      // Restore styles
      content.style.overflow = originalOverflow;
      content.style.maxHeight = originalMaxHeight;
      content.style.width = originalWidth;
      content.style.maxWidth = originalMaxWidth;
      content.style.margin = originalMargin;
      content.style.padding = originalPadding;
      content.style.boxSizing = originalBoxSizing;
      content.style.background = originalBackground;
      document.body.style.overflow = originalBodyOverflow;
    };





    }

    // const toolbar = await waitForToolbar();
    // if (!toolbar || document.getElementById("generateReportBtn")) return;
    const toolbar = await waitForToolbar();
    if (!toolbar || document.getElementById("generateReportBtn")) return;

    // 🚫 Do NOT show button unless this is an Equipment record
    if (!isEquipmentRecord()) {
      console.log("📄 Report button suppressed (not an Equipment record)");
      return;
    }


    const li = document.createElement("li");
    li.id = "generateReportBtn";
    li.className = "ng-scope";
    li.title = "Generate Report";

    const a = document.createElement("a");
    a.style.cursor = "pointer";
    a.innerHTML = `<i class="fas fa-file-pdf"></i>`;
    a.onclick = generateReport;

    li.appendChild(a);
    toolbar.appendChild(li);
  }

  init();
})();


