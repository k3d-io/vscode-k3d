import * as vscode from 'vscode';

import { Cancellable } from "./cancellable";

export interface FormResult {
    [formFieldName: string]: string;
}

export function showHTMLForm(webviewType: string, title: string, formContent: string, formSubmitText: string): Promise<Cancellable<FormResult>> {
    const panel = vscode.window.createWebviewPanel(webviewType, title, vscode.ViewColumn.Active, { enableScripts: true, retainContextWhenHidden: true });
    const webview = panel.webview;
    webview.html = enformify(formContent, formSubmitText);

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

const WEBVIEW_FORM_ID = 'wvform';

function enformify(formContent: string, formSubmitText: string): string {
    const formed = `<html><body>
    <style>
    .link-button {
        background: none;
        border: none;
        color: blue;
        text-decoration: underline;
        cursor: pointer;
        font-size: 1em;
        font-family: sans-serif;
    }
    .vscode-light .link-button {
        color: navy;
    }
    .vscode-dark .link-button {
        color: azure;
    }
    .link-button:focus {
        outline: none;
    }
    .link-button:active {
        color:red;
    }
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

    <form id='${WEBVIEW_FORM_ID}'>
    ${formContent}
    <p>
    <button onclick='onSubmit();' class='link-button'>${formSubmitText} &gt;</button>
    </p>
    </form>
    </body></html>`;

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
