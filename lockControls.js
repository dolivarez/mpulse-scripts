// ================================
// 🔒 lockControls.js
// Purpose: Lock / unlock MPulse UI controls based on Work Order status
// Rules:
//   • View Media (eye icon) is ALWAYS visible
//   • All other media controls hidden ONLY when status = Closed
//   • Works on desktop + mobile (Angular re-render safe)
//   • Removed copy button to prevent unintended record duplication
//
// Updated: 2025-10-21
// ================================

(() => {
  console.log("🔒 lockControls.js initializing...");

  /* --------------------------------
   * Utilities
   * -------------------------------- */
  function waitForElements(selectors, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const check = () => {
        const ok = selectors.every(sel => document.querySelector(sel));
        if (ok) return resolve();
        if (Date.now() - start > timeout) {
          return reject(`Timeout waiting for: ${selectors.join(", ")}`);
        }
        requestAnimationFrame(check);
      };
      check();
    });
  }

  function hide(el) {
    if (!el) return;
    el.style.visibility = "hidden";
    el.style.pointerEvents = "none";
    el.style.opacity = "0.15";
    el.setAttribute("disabled", "true");
    el.setAttribute("tabindex", "-1");
  }

  function show(el) {
    if (!el) return;
    el.style.visibility = "visible";
    el.style.pointerEvents = "auto";
    el.style.opacity = "1";
    el.removeAttribute("disabled");
    el.removeAttribute("tabindex");
  }

  /* --------------------------------
   * MEDIA BUTTON CONTROLLER
   * -------------------------------- */
  function updateMediaButtons(isClosed) {
    // Covers mobile and desktop
    const menuItems = document.querySelectorAll(
      ".mobile-media-inner li, mediabox li"
    );

    if (!menuItems.length) return;

    menuItems.forEach(li => {
      const icon = li.querySelector("i");
      if (!icon) return;

      const cls = icon.classList;

      // ✅ ALWAYS VISIBLE — view media
      if (cls.contains("fa-eye")) {
        show(li);
        return;
      }

      // 🔒 Conditional controls
      if (isClosed) hide(li);
      else show(li);
    });
  }
 
function toggleCopyRecordByType() {
  const moduleEl = document.querySelector(".module-name");
  if (!moduleEl) return;

  const recordType = moduleEl.textContent.toLowerCase();
  const isWorkOrder = recordType.includes("work order");

  const copyCandidates = document.querySelectorAll(
    ".itemDetailActionBtns li, .action-menu-items li"
  );

  copyCandidates.forEach(li => {
    const icon = li.querySelector("i");
    const label = li.textContent?.toLowerCase() || "";

    const isCopyBtn =
      icon?.classList.contains("fa-copy") ||
      icon?.classList.contains("fa-clone") ||
      label.includes("copy");

    if (!isCopyBtn) return;

    if (isWorkOrder) {
      // 🔒 Hide copy in Work Orders
      li.style.visibility = "hidden";
      li.style.pointerEvents = "none";
      li.style.opacity = "0.15";
      li.setAttribute("disabled", "true");
      li.setAttribute("tabindex", "-1");
    } else {
      // ✅ Restore copy elsewhere
      li.style.visibility = "visible";
      li.style.pointerEvents = "auto";
      li.style.opacity = "1";
      li.removeAttribute("disabled");
      li.removeAttribute("tabindex");
    }
  });
}

  
  

  /* --------------------------------
   * CORE LOCK LOGIC
   * -------------------------------- */
  function updateLockState() {
    const statusEl = document.querySelector("#StatusDesc");
    if (!statusEl) return;

    const status = (statusEl.textContent || "").trim().toLowerCase();
    const isClosed = status === "closed";

    /* ---- Standard controls ---- */
    const lockMap = {
      editBtn: "#falHeadWrapper .itemDetailActionBtns li:nth-child(1)",
      commentsInput: "#rightBlock .commentsInput",
      taskEditBtn: "#TaskDetails-header .btncontainer button:nth-child(3)"
    };

    Object.values(lockMap).forEach(sel => {
      const el = document.querySelector(sel);
      if (!el) return;
      isClosed ? hide(el) : show(el);
    });

    /* ---- Media controls ---- */
    updateMediaButtons(isClosed);

    /* ---- Always hidden (business rules) ---- */
    const alwaysHide = [
      "#rightBlock .commentsTitle h3 span.pull-right.pointer", // comment edit icon
      // "#PersonalList ul li div", // personnel ellipsis
      // "#AssetList ul li div"     // asset ellipsis
    ];

    alwaysHide.forEach(sel => {
      document.querySelectorAll(sel).forEach(hide);
    });
    toggleCopyRecordByType();
    console.log(`🔒 lockControls applied — status: ${status}`);
  }

  /* --------------------------------
   * INITIALIZATION
   * -------------------------------- */
  waitForElements(["#StatusDesc"])
    .then(() => {
      updateLockState();
      toggleCopyRecordByType();

      


      // Observe Angular DOM mutations
      const observer = new MutationObserver(updateLockState);
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
      });

      // Re-run after user interactions
      document.addEventListener("click", e => {
  if (e.target.closest("a, button, .dx-item")) {
    setTimeout(() => {
      updateLockState();
      toggleCopyRecordByType();
    }, 300);
  }
});


      // Safety retries during page load
      let tries = 0;
      const retryTimer = setInterval(() => {
        updateLockState();
        if (++tries > 10) clearInterval(retryTimer);
      }, 400);

      console.log("✅ lockControls.js active");
    })
    .catch(err => {
      console.warn("⚠️ lockControls init failed:", err);
    });

})();

