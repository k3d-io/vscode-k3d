
// TODO: this whole file seems to have many things in common with k3d/k3d.ts

import * as vscode from 'vscode';
import * as k8s from 'vscode-kubernetes-tools-api';
import * as shelljs from 'shelljs';
import { ChildProcess } from 'child_process';

import * as form from '../commands/createClusterForm';
import * as settings from '../commands/createClusterSettings';

import { logChannel } from '../utils/log';
import { getKubeconfigPath } from '../utils/kubeconfig';
import { failed } from '../utils/errorable';
import { getOrInstallK3D, EnsureMode } from '../installer/installer';

const K3D_CLUSTER_PROVIDER_ID = 'k3d';

export const K3D_CLUSTER_PROVIDER: k8s.ClusterProviderV1.ClusterProvider = {
    id: K3D_CLUSTER_PROVIDER_ID,
    displayName: 'k3d',
    supportedActions: ['create'],
    next: onNext
};

const PAGE_SETTINGS = 'settings';

function onNext(wizard: k8s.ClusterProviderV1.Wizard, _action: k8s.ClusterProviderV1.ClusterProviderAction, message: any): void {
    wizard.showPage("<h1>Please wait...</h1>");
    const sendingStep: string = message[k8s.ClusterProviderV1.SENDING_STEP_KEY];
    const defaults = settings.getNewClusterSettingsFromLast();
    const htmlPromise = getPage(defaults, sendingStep, message);
    wizard.showPage(htmlPromise);
}

function getPage(defaults: settings.ClusterCreateSettings, sendingStep: string, previousData: any): k8s.ClusterProviderV1.Sequence<string> {
    switch (sendingStep) {
        case k8s.ClusterProviderV1.SELECT_CLUSTER_TYPE_STEP_ID:
            return collectSettings(defaults, previousData);
        case PAGE_SETTINGS:
            return createCluster(previousData);
        default:
            return "Internal error";
    }
}

function collectSettings(defaults: settings.ClusterCreateSettings, previousData: any): string {
    const html = formPage(
        PAGE_SETTINGS,
        "Create k3d cluster",
        form.getCreateClusterForm(defaults),
        "Create",
        form.getCreateClusterFormStyle(),
        form.getCreateClusterFormJavascript(),
        previousData);
    return html;
}

function createCluster(previousData: any): k8s.ClusterProviderV1.Observable<string> {
    return {
        subscribe(observer: k8s.ClusterProviderV1.Observer<string>): void {
            observer.onNext("<h1>Creating k3d Cluster</h1>");
            let stdout = '';
            let stderr = '';
            let resultPara = '';

            let title = 'Creating k3d Cluster';

            // this re-creates a HTML page with all the content (so far)
            // of 1) stdout 2) stderr
            function html() {
                return `<h1>${title}</h1>
                    ${paragraphise(stdout)}
                    ${paragraphise(stderr, 'red')}
                    ${resultPara}`;
            }

            const createSettings = form.createClusterSettingsFromForm(previousData);
            const args = settings.createClusterArgsFromSettings(createSettings);

            let argsStr = args.join(" ");
            argsStr += " --wait --update-default-kubeconfig";

            const k3dExe = getOrInstallK3D(EnsureMode.Alert);
            if (failed(k3dExe)) {
                stderr += k3dExe.error;
                observer.onNext(html());
                return;
            }
            const exe = k3dExe.result;

            const kubeconfig = getKubeconfigPath();
            shelljs.env["KUBECONFIG"] = kubeconfig;

            if (!createSettings.name) {
                logChannel.appendLine(`[ERROR] no cluster name provided in 'createCluster'`);
            }
            const command = `${exe} cluster create ${createSettings.name} ${argsStr}`;

            const childProcess = shelljs.exec(command, { async: true }) as ChildProcess;

            childProcess.stdout.on('data', (chunk: string) => {
                for (let line of chunk.split(/\r?\n/)) {
                    // skip the first charts in the line (the `INFO[0000]` stuff)
                    line = line.substring(20);
                    stdout += line + '\n';
                }
                observer.onNext(html());
            });

            childProcess.stderr.on('data', (chunk: string) => {
                for (let line of chunk.split(/\r?\n/)) {
                    // skip the first charts in the line (the `WARN[0000]` stuff)
                    line = line.substring(20);
                    stderr += line + '\n';
                }
                observer.onNext(html());
            });

            childProcess.on('error', (err: Error) => {
                stderr += err.message;
                observer.onNext(html());
            });

            childProcess.on('exit', (code: number) => {
                if (code === 0) {
                    title = 'Cluster created';
                    resultPara = `<p style='font-weight: bold; color: lightgreen'>Your local cluster has been created and has been merged in your kubeconfig ${kubeconfig}</p>`;
                    settings.saveLastClusterCreateSettings(createSettings);
                    observer.onNext(html());
                } else {
                    title = 'Cluster creation failed';
                    resultPara = `<p style='font-weight: bold; color: red'>Your local cluster was not created.  See tool output above for why.</p>`;
                    observer.onNext(html());
                }

                // refresh the views
                vscode.commands.executeCommand("extension.vsKubernetesRefreshExplorer");
                vscode.commands.executeCommand("extension.vsKubernetesRefreshCloudExplorer");
            });
        }
    };
}

function formPage(stepId: string, title: string,
    formContent: string, formSubmitText: string | null, formStyle: string,
    javascript: string,
    previousData: any): string {

    const buttonHtml = formSubmitText ?
        `<button onclick='${k8s.ClusterProviderV1.NEXT_PAGE}'>
            ${formSubmitText}
        </button>` : '';

    const previousDataFields = Object.keys(previousData)
        .filter((k) => k !== k8s.ClusterProviderV1.SENDING_STEP_KEY)
        .map((k) => `<input type='hidden' name='${k}' value='${previousData[k]}' />`)
        .join('\n');

    const html = `
        <style>
        ${formStyle}
        </style>

        <h1>${title}</h1>

        <form id="${k8s.ClusterProviderV1.WIZARD_FORM_NAME}">
            <input type='hidden' name='${k8s.ClusterProviderV1.SENDING_STEP_KEY}' value='${stepId}' />
            ${previousDataFields}

            ${formContent}

            <p>
                ${buttonHtml}
            </p>
        </form>

        <script>
        ${javascript}
        </script>
    `;

    return html;
}

function paragraphise(text: string, colour?: string): string {
    const colourAttr = colour ? ` style='color:${colour}'` : '';
    const lines = text.split('\n').map((l) => l.trim());
    const paras = lines.map((l) => `<p${colourAttr}>${l}</p>`);
    return paras.join('\n');
}
