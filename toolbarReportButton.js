(function () {
  async function init() {
    console.log("📄 toolbarReportButton.js initialized");

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

      const tbl = ({ headers, rows }) => !rows?.length ? "<p>—</p>" : `
        <div style='overflow:auto;border:1px solid #ccc;border-radius:6px;margin-top:8px;'>
          <table style='border-collapse:collapse;width:100%'>
            ${headers?.length ? `<thead><tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr></thead>` : ""}
            <tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody>
          </table>
        </div>`;

      const overlay = document.createElement("div");
      overlay.id = "reportOverlay";
      Object.assign(overlay.style, {
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 9999,
        display: "flex", justifyContent: "center", alignItems: "center"
      });

      const box = document.createElement("div");
      box.style = `
        background:white;width:90%;max-width:950px;max-height:90vh;
        overflow-y:auto;padding:24px;border-radius:12px;position:relative;
      `;

      const headerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #0078d7;padding-bottom:10px;margin-bottom:15px;">
          <img src="https://mpulse9.com//Media/GetMenuImage?DBName=SOFIE&ImageType=LOGOLG&ImageName=Sofie%20Logo.png" style="height:50px;">
          <h2 style="margin:0;text-align:right;">${type.toUpperCase()} REPORT</h2>
        </div>
      `;

      const reportBody = `
        ${headerHTML}
        <div><strong>ID:</strong> ${data.id}</div>
        <div><strong>Status:</strong> ${data.status}</div>

        <div style="margin-top:10px;padding:10px;background:#f2f2f2;border-left:4px solid #0078d7;border-radius:4px;">
          <strong>Description:</strong><br>${data.desc}
        </div>

        <div style="margin-top:8px;">
          <strong>Opened:</strong> ${data.open} &nbsp;&nbsp;
          <strong>Due:</strong> ${data.due} &nbsp;&nbsp;
          <strong>Done:</strong> ${data.done}
        </div>

        ${tasks ? `<h3 style="margin-top:16px;">Tasks</h3>${tbl(tasks)}` : ""}
        ${assets ? `<h3 style="margin-top:16px;">Assets</h3>${tbl(assets)}` : ""}
        ${people ? `<h3 style="margin-top:16px;">Personnel</h3>${tbl(people)}` : ""}

        <h3 style="margin-top:16px;">Comments</h3>
        <div style="border:1px solid #ccc;border-radius:6px;padding:10px;margin-bottom:12px;">
          ${data.comments}
        </div>

        <div style="text-align:center;margin-top:20px;">
          <button id="downloadPdf" style="background:#0078d7;color:white;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;">
            Download PDF
          </button>
          <button onclick="document.getElementById('reportOverlay').remove()" style="margin-left:8px;padding:10px 20px;cursor:pointer;">
            Close
          </button>
        </div>
      `;

      box.innerHTML = reportBody;
      overlay.appendChild(box);
      document.body.appendChild(overlay);

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

      // PDF generation
      document.getElementById("downloadPdf").onclick = async () => {
        const { jsPDF } = window.jspdf;
        
        // Hide buttons before PDF capture
        const footerButtons = box.querySelectorAll("button, #downloadPdf");
        footerButtons.forEach(btn => btn.style.display = "none");
        
        // ---Expand the modal so NOTHING is cut off ---
  const originalMaxHeight = box.style.maxHeight;
  const originalOverflow = box.style.overflowY;
  
  box.style.maxHeight = "none";   // allow full height
  box.style.overflow = "visible"; // disable scrolling
  
  // Also ensure overlay fills the screen
  const overlay = document.getElementById("reportOverlay");
  const originalOverlayAlign = overlay.style.alignItems;
  overlay.style.alignItems = "flex-start"; // top-align so full height renders

  // Wait 50ms for layout to stabilize
  await new Promise(res => setTimeout(res, 50));

        // Render PDF
        const pdf = new jsPDF("p", "mm", "a4");
        const canvas = await html2canvas(box, { scale: 2 });
        const img = canvas.toDataURL("image/png");

        const width = 210;
        const height = (canvas.height * width) / canvas.width;
        pdf.addImage(img, "PNG", 0, 0, width, height);
        pdf.save(`WorkOrder_${data.id || "Report"}.pdf`);
        
        // Restore buttons after PDF generation
        footerButtons.forEach(btn => btn.style.display = "");
        box.style.overflowY = originalOverflow;
        box.style.maxHeight = originalMaxHeight;

  // Ensure the user can scroll normally again
  overlay.style.overflowY = "auto";
      };
    }

    const toolbar = await waitForToolbar();
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
