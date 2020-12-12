import * as vscode from 'vscode';

import { Cancellable } from "./cancellable";

const WEBVIEW_FORM_ID = 'wvform';

export interface FormResult {
  [formFieldName: string]: string;
}

export function showHTMLForm(webviewType: string,
  title: string,
  formContent: string, formSubmitText: string, formStyle: string,
  javascript: string): Promise<Cancellable<FormResult>> {

  const panel = vscode.window.createWebviewPanel(webviewType,
    title,
    vscode.ViewColumn.Active,
    {
      enableScripts: true, // enable JavaScript in the webview
      retainContextWhenHidden: true
    });

  const webview = panel.webview;
  webview.html = enformify(title, formContent, formSubmitText, formStyle, javascript);

  let done = false;
  return new Promise<Cancellable<FormResult>>((resolve, _reject) => {
    function complete(value: Cancellable<FormResult>) {
      if (!done) {
        done = true;
        resolve(value);
        panel.dispose();
      }
    }
    webview.onDidReceiveMessage((m) => complete({ cancelled: false, value: formResultOf(m) }));
    panel.onDidDispose(() => complete({ cancelled: true }));
    panel.reveal();
  });
}

function enformify(title: string,
  formContent: string, formSubmitText: string, formStyle: string,
  javascript: string): string {

  const titleHtml = title ? `<h1>${title}</h1>` : '';

  const formed = `
    <!DOCTYPE html>
    <html lang="en">
        <head>
            <meta charset="UTF-8">
            <title>${title}</title>
        </head>

        <body>
            <style>
            ${formStyle}
            </style>

            <script>
                const vscode = acquireVsCodeApi();

                function onSubmit() {
                    const s = { };
                    for (const e of document.forms['${WEBVIEW_FORM_ID}'].elements) {
                        s[e.name] = e.value;
                    }
                    vscode.postMessage(s);
                }
            </script>

            ${titleHtml}

            <form id='${WEBVIEW_FORM_ID}'>
                ${formContent}
                <p>
                    <button onclick='onSubmit();'>
                        ${formSubmitText}
                    </button>
                </p>
            </form>

            <script>
            ${javascript}
            </script>
        </body>
    </html>`;

  return formed;
}

function formResultOf(formMessage: any): FormResult {
  const fr: FormResult = {};
  for (const key in formMessage) {
    if (key && key.length > 0) {
      fr[key] = formMessage[key];
    }
  }
  return fr;
}
