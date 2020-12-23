import * as vscode from 'vscode';

import { map, filter } from 'rxjs/operators';
import { Observable } from '../../node_modules/rxjs';

import * as settings from './createClusterSettings';
import * as form from './createClusterForm';

import * as k3d from '../k3d/k3d';

import { logChannel } from '../utils/log';
import { shell, ProcessTrackingEvent } from '../utils/shell';
import { succeeded, Errorable } from '../utils/errorable';
import { longRunningWithMessages, ProgressStep, ProgressUpdate } from '../utils/host';
import { Cancellable } from '../utils/cancellable';
import * as webview from '../utils/webview';
import { refreshKubernetesToolsViews } from '../utils/vscode';
import { cantHappen } from '../utils/never';

//////////////////////////////////////////////////////////////////////////////////////////////
// commands entrypoints
//////////////////////////////////////////////////////////////////////////////////////////////

// entrypoint for the "k3d: create cluster" command
export async function onCreateCluster(target?: any): Promise<void> {
    const defaultSettings = settings.forNewCluster(settings.getDefaultClusterSettings());
    const providedSettings = await promptClusterSettings(defaultSettings);
    if (providedSettings.cancelled) {
        return;
    }
    return createCluster(providedSettings.value, target);
}

// entrypoint for the "k3d: create cluster (with last settings)" command
export async function onCreateClusterLast(target?: any): Promise<void> {
    const lastSettings = settings.forNewCluster(settings.getLastClusterSettings());
    return createCluster(lastSettings, target);
}

//////////////////////////////////////////////////////////////////////////////////////////////

export async function createCluster(createSettings: settings.ClusterCreateSettings, target?: any): Promise<void> {
    if (target) {
        await createClusterInteractive(createSettings);
        return;
    }
    await createClusterInteractive(createSettings);
}

export async function createClusterInteractive(
    clusterSettings: settings.ClusterCreateSettings,
    switchContext: boolean = true): Promise<void> {

    // createClusterProgressOf is invoked for processing each line of output from `k3d cluster create`
    function createClusterProgressOf(e: ProcessTrackingEvent): ProgressStep<Errorable<null>> {
        if (e.eventType === 'line') {
            k3d.strippedLines(e.text).map((l) => logChannel.appendLine(l));

            return {
                type: 'update',
                message: e.text
            };
        } else if (e.eventType === 'succeeded') {
            return {
                type: 'complete',
                value: { succeeded: true, result: null }
            };
        } else if (e.eventType === 'failed') {
            k3d.strippedLines(e.stderr).map((l) => logChannel.appendLine(l));

            return {
                type: 'complete',
                value: { succeeded: false, error: [e.stderr] }
            };
        } else {
            return cantHappen(e);
        }
    }

    const progressSteps = k3d.createCluster(shell, clusterSettings, undefined, switchContext).pipe(
        map((e) => createClusterProgressOf(e)));

    await displayClusterCreationUI(clusterSettings, progressSteps);
}

export async function displayClusterCreationUI(clusterSettings: settings.ClusterCreateSettings, progressSteps: Observable<ProgressStep<Errorable<null>>>): Promise<void> {

    const interestingUpdatePrefix = '• ';

    const stripPrefix = (e: ProgressUpdate) => ({
        type: 'update' as const,
        message: e.message.substring(interestingUpdatePrefix.length)
    } as ProgressUpdate);

    const isIgnorableUpdate = (e: ProgressStep<Errorable<null>>) => e.type === 'update' && !e.message.startsWith(interestingUpdatePrefix);
    const undecorate = (e: ProgressStep<Errorable<null>>) => e.type === 'update' ? stripPrefix(e) : e;

    const progressToDisplay = progressSteps.pipe(
        filter((e) => !isIgnorableUpdate(e)),
        map((e) => undecorate(e))
    );

    const result = await longRunningWithMessages(`Creating k3d cluster "${clusterSettings.name}"`, progressToDisplay);

    async function displayClusterCreationResult(result: Errorable<null>): Promise<void> {
        if (succeeded(result)) {
            await Promise.all([
                vscode.window.showInformationMessage(`Created k3d cluster "${clusterSettings.name}"`),
                refreshKubernetesToolsViews(),
                settings.saveLastClusterCreateSettings(clusterSettings)
            ]);
        } else {
            await vscode.window.showErrorMessage(`Creation of k3d cluster "${clusterSettings.name}" failed: ${result.error[0]}`);
        }
    }

    await displayClusterCreationResult(result);
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////
// cluster settings dialog
////////////////////////////////////////////////////////////////////////////////////////////////////////////

export async function promptClusterSettings(clusterSettings: settings.ClusterCreateSettings): Promise<Cancellable<settings.ClusterCreateSettings>> {
    const formResult = await webview.showHTMLForm(
        "extension.vsKubernetesK3DCreate",
        "Create k3d cluster",
        form.getCreateClusterForm(clusterSettings),
        "Create Cluster",
        form.getCreateClusterFormStyle(),
        form.getCreateClusterFormJavascript());
    if (formResult.cancelled) {
        return formResult;
    }

    return {
        cancelled: false,
        value: form.createClusterSettingsFromForm(formResult.value)
    };
}
