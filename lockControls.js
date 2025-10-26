// ================================
// 🔒 lockControls.js
// Purpose: Automatically disable or enable certain MPulse form elements
//          based on Work Order status ("Closed" state).
// Author: Zevacor Dev Team
// Updated: 2025-10-21
// ================================

(async () => {
  console.log("🔒 lockControls.js initializing...");

  // --- Utility: wait for selectors ---
  function waitForElements(selectors, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const check = () => {
        const ready = selectors.every(sel => document.querySelector(sel));
        if (ready) return resolve();
        if (Date.now() - start > timeout) return reject(`Timeout waiting for ${selectors}`);
        requestAnimationFrame(check);
      };
      check();
    });
  }

  // --- Utility: disable / enable elements ---
  function fullyDisable(el) {
    if (!el) return;
    el.style.visibility = "hidden";
    el.style.pointerEvents = "none";
    el.style.opacity = "0.4";
    el.setAttribute("disabled", "true");
    el.setAttribute("tabindex", "-1");
  }

  function fullyEnable(el) {
    if (!el) return;
    el.style.visibility = "visible";
    el.style.pointerEvents = "auto";
    el.style.opacity = "1";
    el.removeAttribute("disabled");
    el.removeAttribute("tabindex");
  }

  // --- Core Logic ---
  function updateLockState() {
    const statusEl = document.querySelector("#StatusDesc");
    if (!statusEl) return;

    const status = (statusEl.textContent || "").trim().toLowerCase();
    const isClosed = status === "closed";

    const elements = {
      editBtn: "#falHeadWrapper .itemDetailActionBtns li:nth-child(1)",
      commentsInput: "#rightBlock .commentsInput",
      taskEdit: "#TaskDetails-header .btncontainer button:nth-child(3)",
      mediaLink: "#falTabContainerWrapper mediabox li:nth-child(1)",
      mediaUnlink: "#falTabContainerWrapper mediabox li:nth-child(2)",
      mediaEdit: "#falTabContainerWrapper mediabox li:nth-child(3)",
      mediaSet: "#falTabContainerWrapper mediabox li:nth-child(5)"
    };

    for (const key in elements) {
      const el = document.querySelector(elements[key]);
      if (!el) continue;
      isClosed ? fullyDisable(el) : fullyEnable(el);
    }

    // Always hidden items (like “Add Personnel” or “Assign Asset”)
    const alwaysHide = [
      "#rightBlock .commentsTitle h3 span.pull-right.pointer",
      "#PersonalList ul li div",
      "#AssetList ul li div"
    ];

    alwaysHide.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        el.style.visibility = "hidden";
        el.style.pointerEvents = "none";
        el.setAttribute("disabled", "true");
      });
    });

    console.log(`🔒 LockControls applied — status: ${status}`);
  }

  // --- Initialize ---
  try {
    await waitForElements(["#StatusDesc"]);
    updateLockState();

    // Observe DOM changes (for MPulse dynamic reloads)
    const observer = new MutationObserver(updateLockState);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    // Refresh lock state when user interacts
    document.addEventListener("click", e => {
      const t = e.target.closest(".modal,[data-toggle='modal'],button,a");
      if (t) setTimeout(updateLockState, 300);
    });

    // Initial retries
    let tries = 0;
    const timer = setInterval(() => {
      updateLockState();
      if (++tries > 10) clearInterval(timer);
    }, 500);

    console.log("✅ lockControls.js active");
  } catch (err) {
    console.warn("⚠️ lockControls.js failed to initialize:", err);
  }
})();
