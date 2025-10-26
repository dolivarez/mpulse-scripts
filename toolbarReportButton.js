// =============================
// 📄 MPulse Work Order Report Button Injector (PDF clean link only)
// Version: 2025.10.23c
// =============================
(async () => {
  console.log("📄 toolbarReportButton.js initialized");

  const findToolbar = () => document.querySelector(".action-menu-items ul.itemDetailActionBtns");
  async function waitForToolbar(timeout = 15000) {
    const start = Date.now();
    return new Promise((resolve, reject) => {
      (function check() {
        const el = findToolbar();
        if (el) return resolve(el);
        if (Date.now() - start > timeout) return reject("Toolbar not found");
        requestAnimationFrame(check);
      })();
    });
  }

  async function generateReport() {
    const norm = s => (s || "").replace(/\s+/g, " ").trim();
    const get = sel => {
      const el = document.querySelector(sel);
      if (!el) return "—";
      let text = el.innerText.trim();
      if (!text) {
        const input = el.querySelector("input,textarea,.dx-texteditor-input,.dx-textbox-input");
        if (input) text = input.value || input.textContent || "";
      }
      if (!text) {
        const val = el.querySelector(".dx-field-value,.dx-text-content-alignment-left");
        if (val) text = val.innerText.trim();
      }
      return text || "—";
    };

    const comments = (() => {
      const el = document.querySelector(".dx-scrollview-content .ng-binding");
      return el
        ? el.innerHTML.replace(/&nbsp;/g, " ").replace(/\s{2,}/g, " ").trim()
        : "<p>(No comments found)</p>";
    })();

    const parseGrid = (rootSel, isTask = false) => {
      const c = document.querySelector(rootSel);
      if (!c) return { headers: [], rows: [] };
      const rows = [...c.querySelectorAll(".dx-row:not(.dx-header-row):not(.dx-group-row)")];
      if (isTask) {
        const r = rows
          .map(tr => {
            const d = tr.querySelector("td:nth-child(4) div");
            return [d ? norm(d.innerText) : ""];
          })
          .filter(r => r[0]);
        return { headers: ["Description"], rows: r };
      }
      const headers = [...c.querySelectorAll(".dx-header-row td")].map(td => norm(td.innerText)).filter(Boolean);
      const data = rows
        .map(tr => [...tr.querySelectorAll("td")].map(td => norm(td.innerText)).filter(Boolean))
        .filter(r => r.length);
      return { headers, rows: data };
    };

    // Extract media link (SharePoint URL)
    const mediaData = Array.from(document.querySelectorAll(".media_check"))
      .map(el => angular.element(el).scope()?.mediadetails)
      .find(md => md && md.FileType?.toLowerCase() === "url");

    const data = {
      id: get("#ID"),
      desc: get("#Description"),
      status: get("#StatusDesc"),
      open: get("#Open"),
      due: get("#Due"),
      done: get("#DateDone"),
    };
    const tasks = parseGrid("#TaskList", true);
    const assets = parseGrid("#AssetList");
    const people = parseGrid("#PersonalList");

    const tbl = ({ headers, rows }) =>
      !rows.length
        ? "<p>—</p>"
        : `<div style='overflow:auto;border:1px solid #ccc;border-radius:6px;margin-top:8px;'>
            <table style='border-collapse:collapse;width:100%'>
              <thead>${headers.length ? "<tr>" + headers.map(h => `<th>${h}</th>`).join("") + "</tr>" : ""}</thead>
              <tbody>${rows.map(r => "<tr>" + r.map(c => `<td>${c}</td>`).join("") + "</tr>").join("")}</tbody>
            </table>
          </div>`;

    // Remove existing overlay if open
    const old = document.getElementById("reportOverlay");
    if (old) old.remove();

    const overlay = document.createElement("div");
    overlay.id = "reportOverlay";
    Object.assign(overlay.style, {
      position: "fixed",
      inset: "0",
      background: "rgba(0,0,0,0.45)",
      zIndex: "999999",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      opacity: "0",
      transition: "opacity 0.3s ease",
    });

    const box = document.createElement("div");
    Object.assign(box.style, {
      background: "white",
      width: "90%",
      maxWidth: "950px",
      maxHeight: "90vh",
      overflowY: "auto",
      borderRadius: "12px",
      fontFamily: "Arial, sans-serif",
      boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
      padding: "24px",
      position: "relative",
      transform: "scale(0.95)",
      transition: "transform 0.3s ease",
    });

    const closeX = document.createElement("div");
    closeX.innerHTML = "&times;";
    Object.assign(closeX.style, {
      position: "absolute",
      top: "10px",
      right: "16px",
      fontSize: "28px",
      fontWeight: "bold",
      color: "#666",
      cursor: "pointer",
      transition: "color 0.2s ease",
    });
    closeX.onmouseover = () => (closeX.style.color = "#000");
    closeX.onmouseout = () => (closeX.style.color = "#666");

    const header = `
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #0078d7;padding-bottom:8px;margin-bottom:12px;">
        <h2 style="margin:0;">Work Order Report</h2>
        <img src="https://mpulse9.com//Media/GetMenuImage?DBName=SOFIE&ImageType=LOGOLG&ImageName=Sofie%20Logo.png" style="height:50px;">
      </div>`;

    // Media section ABOVE buttons
    const mediaSection = mediaData
      ? `
        <h3 style="margin-top:16px;">Media</h3>
        <div style="border:1px solid #ccc;border-radius:6px;padding:10px;margin-bottom:12px;">
          <a href="${mediaData.FileName}" target="_blank" style="color:#0078d7;text-decoration:underline;font-size:16px;">
            View Linked Media
          </a>
        </div>`
      : "";

    const body = `
      <div><strong>ID:</strong> ${data.id}</div>
      <div><strong>Status:</strong> ${data.status}</div>
      <div style="margin-top:10px;padding:10px;background:#f2f2f2;border-left:4px solid #0078d7;border-radius:4px;">
        <strong>Description:</strong><br>${data.desc}
      </div>
      <div style="margin-top:8px;"><strong>Opened:</strong> ${data.open} &nbsp;&nbsp; <strong>Due:</strong> ${data.due} &nbsp;&nbsp; <strong>Done:</strong> ${data.done}</div>
      <h3 style="margin-top:16px;">Tasks</h3>${tbl(tasks)}
      <h3 style="margin-top:16px;">Assets</h3>${tbl(assets)}
      <h3 style="margin-top:16px;">Personnel</h3>${tbl(people)}
      <h3 style="margin-top:16px;">Comments</h3>
      <div style="border:1px solid #ccc;border-radius:6px;padding:10px;margin-bottom:12px;">${comments}</div>
      ${mediaSection}
      <div style="text-align:center;">
        <button id="downloadPdf" style="background:#555;color:white;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;">Download PDF</button>
        <button id="closeReport" style="margin-left:8px;padding:10px 20px;cursor:pointer;">Close</button>
      </div>`;

    box.innerHTML = header + body;
    box.appendChild(closeX);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    requestAnimationFrame(() => {
      overlay.style.opacity = "1";
      box.style.transform = "scale(1)";
    });

    const closeOverlay = () => {
      overlay.style.opacity = "0";
      box.style.transform = "scale(0.95)";
      setTimeout(() => overlay.remove(), 300);
    };
    closeX.onclick = closeOverlay;
    document.getElementById("closeReport").onclick = closeOverlay;
    document.addEventListener("keydown", e => e.key === "Escape" && closeOverlay(), { once: true });

    // Load jsPDF + html2canvas
    if (!window.jspdf) {
      await Promise.all([
        new Promise((res, rej) => {
          const s = document.createElement("script");
          s.src = "https://cdn.jsdelivr.net/gh/dolivarez/mpulse-scripts@main/jspdf.umd.min.js";
          s.onload = res; s.onerror = rej; document.head.appendChild(s);
        }),
        new Promise((res, rej) => {
          const s = document.createElement("script");
          s.src = "https://cdn.jsdelivr.net/gh/dolivarez/mpulse-scripts@main/html2canvas.min.js";
          s.onload = res; s.onerror = rej; document.head.appendChild(s);
        })
      ]);
    }

    // 📄 PDF generation
    document.getElementById("downloadPdf").onclick = async () => {
      const { jsPDF } = window.jspdf;
      const toHide = [closeX, document.getElementById("closeReport"), document.getElementById("downloadPdf")];
      toHide.forEach(el => el && (el.style.display = "none"));

      const canvas = await html2canvas(box, { scale: 2 });
      const img = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const width = 210;
      const height = (canvas.height * width) / canvas.width;
      pdf.addImage(img, "PNG", 0, 0, width, height);

      // Only the text "View Linked Media" as a clickable link
      if (mediaData) {
        pdf.setFontSize(12);
        pdf.setTextColor(0, 102, 204);
        pdf.textWithLink("View Linked Media", 15, height - 10, { url: mediaData.FileName });
      }

      pdf.save(`WorkOrder_${data.id || "Report"}.pdf`);
      toHide.forEach(el => el && (el.style.display = ""));
    };
  }

  async function addReportButton() {
    const toolbar = findToolbar();
    if (!toolbar || document.getElementById("generateReportBtn")) return;
    console.log("✅ Toolbar found");

    const li = document.createElement("li");
    li.id = "generateReportBtn";
    li.className = "ng-scope";
    li.title = "Generate Work Order Report";
    const link = document.createElement("a");
    link.style.cursor = "pointer";
    const icon = document.createElement("i");
    icon.className = "fas fa-file-pdf";
    link.appendChild(icon);
    li.appendChild(link);
    toolbar.appendChild(li);
    li.addEventListener("click", generateReport);
  }

  try {
    await waitForToolbar();
    addReportButton();
  } catch {
    console.warn("⚠️ Toolbar not found initially, observing...");
  }

  new MutationObserver(() => addReportButton())
    .observe(document.body, { childList: true, subtree: true });
})();


