# Gmail Clean Print

A userscript that strips Gmail's print view down to just the email body — no Gmail logo, no account header, no subject line, no From/To/Date metadata, no margins.

Useful when you want to print or save an email as PDF and only care about the actual content.

## What it removes

From Gmail's print page (`?view=pt`):

- Gmail logo and account email at the top
- The bold subject line
- The Sender + Date row
- The To: / Reply-To: row
- All surrounding margins and padding

The email body itself is preserved untouched.

## Install

1. Install a userscript manager:
   - [Tampermonkey](https://www.tampermonkey.net/) (Chrome, Edge, Firefox, Safari)
   - [Violentmonkey](https://violentmonkey.github.io/) (Chrome, Firefox)
   - [Greasemonkey](https://www.greasespot.net/) (Firefox)
2. Open [`gmail-clean-print.user.js`](./gmail-clean-print.user.js) and click the **Raw** button (or your manager's install prompt should pop up).
3. Confirm the install.

## Usage

1. In Gmail, open an email and click the print icon (or press `Ctrl/Cmd + P` from within an open email).
2. Gmail opens its print preview in a new tab — the script runs there automatically and hides the chrome.
3. Print or save as PDF as normal.

## How it works

The script injects a small CSS block at `document-start` that hides the unwanted elements via `display: none !important`. No DOM mutation, no observers — just CSS targeting Gmail's print-page structure:

```
.bodycontainer
├── <table>  Gmail logo + account email   → hidden
├── <hr>                                  → hidden
└── .maincontent
    ├── <table>  subject line             → hidden
    ├── <hr>                              → hidden
    └── table.message
        ├── <tr>  Sender + Date           → hidden
        ├── <tr>  To / Reply-To           → hidden
        └── <tr>  email body              → kept
```

If Gmail changes its print-page markup, the selectors in `gmail-clean-print.user.js` may need updating.

## License

MIT
