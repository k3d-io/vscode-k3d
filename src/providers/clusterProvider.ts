
// TODO: this whole file seems to have many things in common with k3d/k3d.ts

import * as k8s from 'vscode-kubernetes-tools-api';
import { Observable } from '../../node_modules/rxjs';
import { map } from 'rxjs/operators';

import * as create from '../commands/createCluster';
import * as form from '../commands/createClusterForm';
import * as settings from '../commands/createClusterSettings';

import * as k3d from '../k3d/k3d';

import * as config from '../utils/config';
import { Errorable } from '../utils/errorable';
import { shell, ProcessTrackingEvent } from '../utils/shell';
import { cantHappen } from '../utils/never';
import { ProgressStep } from '../utils/host';

const K3D_CLUSTER_PROVIDER_ID = 'k3d';

export const K3D_CLUSTER_PROVIDER: k8s.ClusterProviderV1.ClusterProvider = {
    id: K3D_CLUSTER_PROVIDER_ID,
    displayName: 'k3d',
    supportedActions: ['create'],
    next: onNext
};

const PAGE_SETTINGS = 'settings';

async function onNext(wizard: k8s.ClusterProviderV1.Wizard, _action: k8s.ClusterProviderV1.ClusterProviderAction, message: any): Promise<void> {
    wizard.showPage("<h1>Please wait...</h1>");
    const sendingStep: string = message[k8s.ClusterProviderV1.SENDING_STEP_KEY];
    const defaultSettings = settings.forNewCluster(settings.getDefaultClusterSettings());
    const htmlPromise = await getPage(defaultSettings, sendingStep, message);
    wizard.showPage(htmlPromise);
}

async function getPage(defaults: settings.ClusterCreateSettings, sendingStep: string, previousData: any): Promise<k8s.ClusterProviderV1.Sequence<string>> {
    switch (sendingStep) {
        case k8s.ClusterProviderV1.SELECT_CLUSTER_TYPE_STEP_ID:
            return getPageSettings(defaults, previousData);
        case PAGE_SETTINGS:
            return await getPageCreatingCluster(previousData);
        default:
            return "Internal error";
    }
}

// getPageSettings shows the web page with the form with the new cluster details
async function getPageSettings(defaults: settings.ClusterCreateSettings, previousData: any): Promise<string> {
    const html = formPage(
        PAGE_SETTINGS,
        "Create k3d cluster",
        await form.getCreateClusterForm(defaults),
        "Create",
        form.getCreateClusterFormStyle(),
        form.getCreateClusterFormJavascript(),
        previousData);
    return html;
}

// getPageCreatingCluster shows the web page that show how the cluster is being created
async function getPageCreatingCluster(previousData: any): Promise<k8s.ClusterProviderV1.Observable<string>> {
    return {
        async subscribe(observer: k8s.ClusterProviderV1.Observer<string>): Promise<void> {
            observer.onNext("<h1>Creating k3d Cluster</h1>");

            let stdout = '';
            let stderr = '';
            let resultPara = '';
            let title = 'Creating k3d Cluster';

            // this re-creates a HTML page with all the content (so far)
            // of 1) stdout 2) stderr
            function asHTML() {
                return `<h1>${title}</h1>
                    ${paragraphise(stdout)}
                    ${paragraphise(stderr, 'red')}
                    ${resultPara}`;
            }

            // createClusterProgressOf is invoked for processing each line of output from `k3d cluster create`
            function createClusterProgressOf(e: ProcessTrackingEvent): ProgressStep<Errorable<null>> {
                if (e.eventType === 'line') {
                    stdout += k3d.strippedLines(e.text)
                        .map((l) => `<p>${l}</p>`);
                    observer.onNext(asHTML());

                    return {
                        type: 'update',
                        message: e.text
                    };
                } else if (e.eventType === 'succeeded') {
                    title = 'Cluster created';
                    resultPara = `<p style='font-weight: bold; color: lightgreen'>Your local cluster has been created.</p>`;
                    settings.saveLastClusterCreateSettings(createSettings);
                    observer.onNext(asHTML());

                    return {
                        type: 'complete',
                        value: {
                            succeeded: true,
                            result: null
                        }
                    };
                } else if (e.eventType === 'failed') {
                    stderr += k3d.strippedLines(e.stderr)
                        .map((l) => `<p>${l}</p>`);
                    observer.onNext(asHTML());
                    return {
                        type: 'complete',
                        value: {
                            succeeded: false,
                            error: [e.stderr]
                        }
                    };
                } else {
                    return cantHappen(e);
                }
            }

            const createSettings = form.createClusterSettingsFromForm(previousData);

            const kubeconfig = await config.getK3DKubeconfigPath();

            const progressSteps: Observable<ProgressStep<Errorable<null>>> = k3d.createCluster(shell,
                createSettings, kubeconfig).pipe(
                    map((e) => createClusterProgressOf(e))
                );

            create.displayClusterCreationUI(createSettings, progressSteps);
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
