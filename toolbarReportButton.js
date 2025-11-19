(function () {
  async function init() {
    console.log("📄 toolbarReportButton.js initialized");

    // Utility: normalize text content
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

    // Dynamic table parser
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

    const waitForToolbar = (timeout = 15000) => new Promise((resolve, reject) => {
      const start = Date.now();
      (function check() {
        const el = document.querySelector(".action-menu-items ul.itemDetailActionBtns");
        if (el) return resolve(el);
        if (Date.now() - start > timeout) return reject("Toolbar not found");
        requestAnimationFrame(check);
      })();
    });

    const detectRecordType = () => {
      const el = document.querySelector(".module-name");
      return el?.textContent?.trim().toLowerCase() || "unknown";
    };

    async function generateReport() {
      const type = detectRecordType();
      const data = {
        id: getText("#ID"),
        desc: getText("#Description"),
        status: getText("#StatusDesc"),
        open: getText("#Open"),
        due: getText("#Due"),
        done: getText("#DateDone"),
        comments: (() => {
          const el = document.querySelector(".dx-scrollview-content .ng-binding");
          return el?.innerHTML?.replace(/&nbsp;/g, " ").replace(/\s{2,}/g, " ").trim() || "(No comments found)";
        })(),
      };

      const tasks = type.includes("work order") ? parseGrid("#TaskList", true, ["ID", "Description"]) : null;
      const assets = ["work order", "scheduled maintenance"].some(t => type.includes(t)) ? parseGrid("#AssetList") : null;
      const people = ["work order", "scheduled maintenance"].some(t => type.includes(t)) ? parseGrid("#PersonalList") : null;

      const mediaData = Array.from(document.querySelectorAll(".media_check"))
        .map(el => angular.element(el).scope()?.mediadetails)
        .find(md => md?.FileType?.toLowerCase() === "url");

      const tbl = ({ headers, rows }) => !rows?.length ? "<p>—</p>" : `
        <div style='overflow:auto;border:1px solid #ccc;border-radius:6px;margin-top:8px;'>
          <table style='border-collapse:collapse;width:100%'>
            ${headers?.length ? `<thead><tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr></thead>` : ""}
            <tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody>
          </table>
        </div>`;

      const reportBody = `
        <div><strong>ID:</strong> ${data.id}</div>
        <div><strong>Status:</strong> ${data.status}</div>
        <div style="margin-top:10px;padding:10px;background:#f2f2f2;border-left:4px solid #0078d7;border-radius:4px;">
          <strong>Description:</strong><br>${data.desc}
        </div>
        <div style="margin-top:8px;"><strong>Opened:</strong> ${data.open} &nbsp;&nbsp; <strong>Due:</strong> ${data.due} &nbsp;&nbsp; <strong>Done:</strong> ${data.done}</div>
        ${tasks ? `<h3 style="margin-top:16px;">Tasks</h3>${tbl(tasks)}` : ""}
        ${assets ? `<h3 style="margin-top:16px;">Assets</h3>${tbl(assets)}` : ""}
        ${people ? `<h3 style="margin-top:16px;">Personnel</h3>${tbl(people)}` : ""}
        <h3 style="margin-top:16px;">Comments</h3>
        <div style="border:1px solid #ccc;border-radius:6px;padding:10px;margin-bottom:12px;">${data.comments}</div>
        ${mediaData ? `<div><a href="${mediaData.FileName}" target="_blank" style="color:#0078d7;">📎 View Linked Media</a></div>` : ""}`;

      const overlay = document.createElement("div");
      overlay.id = "reportOverlay";
      Object.assign(overlay.style, {
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 9999,
        display: "flex", justifyContent: "center", alignItems: "center"
      });

      const box = document.createElement("div");
      box.style = "background:white;width:90%;max-width:950px;max-height:90vh;overflow-y:auto;padding:24px;border-radius:12px;";
      box.innerHTML = `<h2>${type.toUpperCase()} REPORT</h2>` + reportBody +
        `<div style="text-align:center;margin-top:20px;"><button onclick="document.getElementById('reportOverlay').remove()">Close</button></div>`;

      overlay.appendChild(box);
      document.body.appendChild(overlay);
    }

    const toolbar = await waitForToolbar().catch(console.warn);
    if (!toolbar || document.getElementById("generateReportBtn")) return;

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
