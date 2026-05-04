// ==UserScript==
// @name         Gmail Clean Print Button
// @namespace    https://github.com/wooneusean
// @version      2.1
// @description  Adds a "Clean Print" button to open Gmail emails. Prints just the body — no header, no From/To/Date, no margins, no browser-added URL/title.
// @author       Woon Eusean
// @match        https://mail.google.com/mail/*
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/wooneusean/gmail-clean-print/main/gmail-clean-print.user.js
// @downloadURL  https://raw.githubusercontent.com/wooneusean/gmail-clean-print/main/gmail-clean-print.user.js
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  const BODY_SELECTOR = "div.a3s";
  const BUTTON_CLASS = "clean-print-btn";
  const IFRAME_ID = "clean-print-iframe";
  const VISIBILITY_POLL_MS = 1000;
  const PRINT_FAILSAFE_MS = 3000;
  const IFRAME_CLEANUP_MS = 30_000;

  const BUTTON_STYLE = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 9999;
      padding: 12px 20px;
      background: #1a73e8;
      color: white;
      border: none;
      border-radius: 24px;
      font-family: 'Google Sans', Roboto, Arial, sans-serif;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      box-shadow: 0 2px 6px rgba(0,0,0,0.2);
      display: none;
  `;

  const PRINT_CSS = `
    @page {
        margin: 0;
        size: auto;
    }
    html, body {
        margin: 0;
        padding: 0;
        font-family: Arial, sans-serif;
        font-size: 13px;
        color: #000;
        background: white;
    }
    body {
        padding: 16px;
    }
    .a3s, .ii, .gt, .adP, .adO {
        padding: 0 !important;
        margin: 0 !important;
    }
    img { max-width: 100%; height: auto; }
  `;

  /**
   * Find the currently visible email body.
   *
   * Cheap version: we only check existence and visibility. We deliberately
   * avoid touching .innerHTML on every poll (the previous version did
   * `el.innerHTML.trim()` on potentially MB-scale email bodies twice a second).
   * For visibility detection, `offsetParent !== null` is sufficient — Gmail
   * doesn't render empty .a3s divs in the open-email view.
   */
  function getOpenEmailBody() {
    const bodies = document.querySelectorAll(BODY_SELECTOR);
    if (bodies.length === 0) return null;
    // Iterate from the end — the last visible one is typically the open email.
    for (let i = bodies.length - 1; i >= 0; i--) {
      if (bodies[i].offsetParent !== null) return bodies[i];
    }
    return null;
  }

  /**
   * Print using a hidden iframe, building its content via DOM API only.
   *
   * Why this approach: Gmail's CSP enforces `require-trusted-types-for 'script'`
   * which blocks all HTML-parsing sinks (innerHTML, srcdoc, document.write).
   * Building via createElement/appendChild/cloneNode is not a parsing path,
   * so Trusted Types doesn't restrict it.
   */
  function printViaIframe(bodyEl, subject) {
    // Remove any leftover iframe from a previous click. This also cancels any
    // in-flight image listeners on the old iframe via DOM detachment + GC.
    const existing = document.getElementById(IFRAME_ID);
    if (existing) existing.remove();

    const iframe = document.createElement("iframe");
    iframe.id = IFRAME_ID;
    iframe.style.cssText = `
        position: fixed;
        left: -9999px;
        top: 0;
        width: 800px;
        height: 600px;
        border: 0;
    `;
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow.document;

    try {
      doc.title = subject;
    } catch (e) {
      /* non-critical */
    }

    const style = doc.createElement("style");
    style.textContent = PRINT_CSS;
    doc.head.appendChild(style);

    const adopted = doc.adoptNode(bodyEl.cloneNode(true));
    doc.body.appendChild(adopted);

    // ---- Print orchestration with cleanup tracking ----
    //
    // We need to:
    //   1. Print exactly once (not multiple times via failsafe + image-load race)
    //   2. Cancel pending timers when they're no longer needed
    //   3. Remove image listeners we added (so we don't leak references if
    //      the iframe is removed early by a subsequent click)
    //
    // Strategy: keep a `state` object holding all our outstanding work, and
    // a `cancelAll()` that tears it down. triggerPrint() is idempotent.

    const state = {
      printed: false,
      failsafeTimer: null,
      cleanupTimer: null,
      imgListeners: [], // [{img, handler}, ...]
    };

    const cancelImgListeners = () => {
      for (const { img, handler } of state.imgListeners) {
        img.removeEventListener("load", handler);
        img.removeEventListener("error", handler);
      }
      state.imgListeners.length = 0;
    };

    const triggerPrint = () => {
      if (state.printed) return;
      state.printed = true;

      // Cancel the failsafe — we don't want it firing again later
      if (state.failsafeTimer !== null) {
        clearTimeout(state.failsafeTimer);
        state.failsafeTimer = null;
      }
      // Stop listening for images — print is happening now
      cancelImgListeners();

      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (e) {
        alert("Clean Print failed: " + e.message);
      }

      // Schedule iframe removal. The user is likely interacting with the print
      // dialog, so we wait long enough for them to finish, then clean up.
      state.cleanupTimer = setTimeout(() => {
        state.cleanupTimer = null;
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      }, IFRAME_CLEANUP_MS);
    };

    // ---- Image-load handling ----
    const imgs = doc.images;
    if (imgs.length === 0) {
      // No images — print on next tick (lets the cloned tree paint first)
      state.failsafeTimer = setTimeout(triggerPrint, 50);
      return;
    }

    let remaining = imgs.length;
    const onImg = () => {
      remaining--;
      if (remaining <= 0) triggerPrint();
    };
    for (let i = 0; i < imgs.length; i++) {
      const img = imgs[i];
      if (img.complete) {
        onImg();
      } else {
        img.addEventListener("load", onImg);
        img.addEventListener("error", onImg);
        state.imgListeners.push({ img, handler: onImg });
      }
    }
    // Failsafe in case some image stalls forever
    state.failsafeTimer = setTimeout(triggerPrint, PRINT_FAILSAFE_MS);
  }

  function cleanPrint() {
    const bodyEl = getOpenEmailBody();
    if (!bodyEl) {
      alert("Clean Print: no email body found. Open an email first.");
      return;
    }

    const subjectEl =
      document.querySelector("h2.hP") ||
      document.querySelector("[data-thread-perm-id] h2");
    const subject = subjectEl ? subjectEl.textContent.trim() : "Email";

    printViaIframe(bodyEl, subject);
  }

  function injectButton() {
    if (document.querySelector("." + BUTTON_CLASS)) return;

    const btn = document.createElement("button");
    btn.className = BUTTON_CLASS;
    btn.textContent = "🖨 Clean Print";
    btn.style.cssText = BUTTON_STYLE;
    btn.addEventListener("click", cleanPrint);
    document.body.appendChild(btn);

    // Visibility polling. We track the previous state and only mutate the DOM
    // when it actually changes — avoids triggering style recalcs every tick.
    let lastVisible = null;
    setInterval(() => {
      const visible = !!getOpenEmailBody();
      if (visible !== lastVisible) {
        btn.style.display = visible ? "block" : "none";
        lastVisible = visible;
      }
    }, VISIBILITY_POLL_MS);
  }

  const waitForBody = setInterval(() => {
    if (document.body) {
      clearInterval(waitForBody);
      injectButton();
    }
  }, 200);
})();
