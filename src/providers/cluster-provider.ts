
// TODO: this whole file seems to have many things in common with k3d/k3d.ts

import * as k8s from 'vscode-kubernetes-tools-api';
import * as shelljs from 'shelljs';
import { ChildProcess } from 'child_process';
import { k3dExe } from '../k3d/k3d';
import * as k3d from '../k3d/k3d';
import { getActiveKubeconfig } from '../utils/kubeconfig';

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
    const htmlPromise = getPage(sendingStep, message);
    wizard.showPage(htmlPromise);
}

function getPage(sendingStep: string, previousData: any): k8s.ClusterProviderV1.Sequence<string> {
    switch (sendingStep) {
        case k8s.ClusterProviderV1.SELECT_CLUSTER_TYPE_STEP_ID:
            return collectSettings(previousData);
        case PAGE_SETTINGS:
            return createCluster(previousData);
        default:
            return "Internal error";
    }
}

function collectSettings(previousData: any): string {
    const html = formPage(
        PAGE_SETTINGS,
        "Create k3d Cluster",
        k3d.createClusterHTML,
        "Create",
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

            function html() {
                return `<h1>${title}</h1>${paragraphise(stdout)}${paragraphise(stderr, 'red')}${resultPara}`;
            }

            const settings = k3d.createClusterSettingsFromForm(previousData);
            const args = k3d.createClusterArgsFromSettings(settings);

            let argsStr = args.join(" ");
            argsStr += " --wait --update-default-kubeconfig";

            const exe = k3dExe();
            shelljs.env["KUBECONFIG"] = getActiveKubeconfig();
            const command = `${exe} cluster create ${settings.name} ${argsStr}`;

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
                    resultPara = `<p style='font-weight: bold; color: lightgreen'>Your local cluster has been created BUT HAS NOT BEEN set as active in your kubeconfig</p>`;
                    observer.onNext(html());

                    shelljs.exec(`${exe} kubeconfig get ${settings.name}`, { async: true }, (code, pStdout, _pStderr) => {
                        if (code === 0) {
                            const kcpath = pStdout.trim();
                            resultPara = `<p style='font-weight: bold; color: lightgreen'>Your local cluster has been created and its kubeconfig is at ${kcpath}. To work with your cluster, switch to this kubeconfig, or copy settings from this file to your main kubeconfig.</p>`;
                            observer.onNext(html());
                        }
                    });
                } else {
                    title = 'Cluster creation failed';
                    resultPara = `<p style='font-weight: bold; color: red'>Your local cluster was not created.  See tool output above for why.</p>`;
                    observer.onNext(html());
                }
            });
        }
    };
}

function formPage(stepId: string, title: string, body: string, buttonCaption: string | null, previousData: any): string {
    const buttonHtml = buttonCaption ? `<button onclick='${k8s.ClusterProviderV1.NEXT_PAGE}'>${buttonCaption}</button>` : '';
    const previousDataFields = Object.keys(previousData)
        .filter((k) => k !== k8s.ClusterProviderV1.SENDING_STEP_KEY)
        .map((k) => `<input type='hidden' name='${k}' value='${previousData[k]}' />`)
        .join('\n');
    const html = `<h1>${title}</h1>
    <form id="${k8s.ClusterProviderV1.WIZARD_FORM_NAME}">
        <input type='hidden' name='${k8s.ClusterProviderV1.SENDING_STEP_KEY}' value='${stepId}' />
        ${previousDataFields}
        ${body}
        <p>${buttonHtml}</p>
    </form>
    `;

    return html;
}

function paragraphise(text: string, colour?: string): string {
    const colourAttr = colour ? ` style='color:${colour}'` : '';
    const lines = text.split('\n').map((l) => l.trim());
    const paras = lines.map((l) => `<p${colourAttr}>${l}</p>`);
    return paras.join('\n');
}
