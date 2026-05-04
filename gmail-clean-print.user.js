// ==UserScript==
// @name         Gmail Clean Print - Body Only
// @namespace    https://github.com/yourusername
// @version      1.2
// @description  Strips Gmail's print view down to just the email body — no logo, no subject, no From/To/Date, no margins.
// @author       You
// @match        https://mail.google.com/mail/*view=pt*
// @match        https://mail.google.com/mail/*view=print*
// @run-at       document-start
// @updateURL    https://raw.githubusercontent.com/wooneusean/gmail-clean-print/main/gmail-clean-print.user.js
// @downloadURL  https://raw.githubusercontent.com/wooneusean/gmail-clean-print/main/gmail-clean-print.user.js
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // Print-page structure (.bodycontainer > ...):
    //   1. <table> Gmail logo + account email          -> HIDE
    //   2. <hr>                                        -> HIDE
    //   3. <div class="maincontent">
    //        <table> bold subject line                 -> HIDE
    //        <hr>                                      -> HIDE
    //        <table class="message">
    //          <tr> Sender + Date                      -> HIDE
    //          <tr> To: / Reply-To:                    -> HIDE
    //          <tr> ...email body...                   -> KEEP
    //        </table>
    //   </div>

    const css = `
        /* Hide everything in .bodycontainer EXCEPT .maincontent
           (kills logo table + the <hr> after it) */
        body > .bodycontainer > *:not(.maincontent) { display: none !important; }

        /* Inside .maincontent, hide the subject table and the <hr> below it.
           The .message table (which holds the body) is the last child and stays visible. */
        .maincontent > table:not(.message),
        .maincontent > hr {
            display: none !important;
        }

        /* In the message table, hide the From/Date row and the To/Reply-To row.
           Everything after that (the body) is preserved. */
        table.message > tbody > tr:nth-child(1),
        table.message > tbody > tr:nth-child(2) {
            display: none !important;
        }

        /* Zero out all surrounding spacing */
        html, body, .bodycontainer, .maincontent {
            margin: 0 !important;
            padding: 0 !important;
        }
    `;

    const style = document.createElement('style');
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
})();
