// ==UserScript==
// @name         Gmail Clean Print Button
// @namespace    https://github.com/wooneusean
// @version      2.0
// @description  Adds a "Clean Print" button to open Gmail emails. Prints just the body — no header, no From/To/Date, no margins. Works on desktop and mobile Gmail.
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
  const LOG_PREFIX = "[CleanPrint]";

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

  function log(...args) {
    console.log(LOG_PREFIX, ...args);
  }

  /**
   * Find the currently visible email body. We don't just grab the last .a3s
   * because Gmail can have hidden/cached message bodies in the DOM. We need
   * one that's actually rendered.
   */
  function getOpenEmailBody() {
    const bodies = Array.from(document.querySelectorAll(BODY_SELECTOR));
    // Filter for visible elements (offsetParent is null for hidden nodes)
    const visible = bodies.filter(
      (el) => el.offsetParent !== null && el.innerHTML.trim().length > 0,
    );
    if (visible.length === 0) {
      log("No visible email body found. Total .a3s in DOM:", bodies.length);
      return null;
    }
    return visible[visible.length - 1];
  }

  function escapeHtml(s) {
    return s.replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  }

  function buildPrintHtml(bodyHtml, subject) {
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(subject)}</title>
<style>
    @page { margin: 0.5in; }
    html, body {
        margin: 0;
        padding: 0;
        font-family: Arial, sans-serif;
        font-size: 13px;
        color: #000;
    }
    img { max-width: 100%; height: auto; }
</style>
</head>
<body>
${bodyHtml}
<script>
    // Auto-print once everything (including images) loads
    window.addEventListener('load', function () {
        // Tiny delay so layout settles
        setTimeout(function () { window.print(); }, 200);
    });
<\/script>
</body>
</html>`;
  }

  function cleanPrint() {
    const bodyEl = getOpenEmailBody();
    if (!bodyEl) {
      alert("Clean Print: no email body found. Open an email first.");
      return;
    }
    log("Found email body, length:", bodyEl.innerHTML.length);

    const subjectEl =
      document.querySelector("h2.hP") ||
      document.querySelector("[data-thread-perm-id] h2");
    const subject = subjectEl ? subjectEl.textContent.trim() : "Email";
    log("Subject:", subject);

    const html = buildPrintHtml(bodyEl.innerHTML, subject);

    // Use a Blob URL instead of document.write — much more reliable in Firefox,
    // both desktop and Android. The new window loads a real document from the
    // blob: URL with its own lifecycle, no race conditions with document.write.
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    log("Blob URL created:", url);

    const printWin = window.open(url, "_blank");
    if (!printWin) {
      alert(
        "Clean Print: popup blocked. Please allow popups for mail.google.com.",
      );
      URL.revokeObjectURL(url);
      return;
    }

    // Revoke the blob URL after the window has had time to load it.
    // Don't revoke immediately or the page may not load.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  function injectButton() {
    if (document.querySelector("." + BUTTON_CLASS)) return;

    const btn = document.createElement("button");
    btn.className = BUTTON_CLASS;
    btn.textContent = "🖨 Clean Print";
    btn.style.cssText = BUTTON_STYLE;
    btn.addEventListener("click", cleanPrint);
    document.body.appendChild(btn);
    log("Button injected");

    setInterval(() => {
      const hasOpenEmail = !!getOpenEmailBody();
      btn.style.display = hasOpenEmail ? "block" : "none";
    }, 500);
  }

  const waitForBody = setInterval(() => {
    if (document.body) {
      clearInterval(waitForBody);
      injectButton();
    }
  }, 200);
})();
