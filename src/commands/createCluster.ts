import * as vscode from 'vscode';

import { map, filter } from 'rxjs/operators';
import { Observable } from '../../node_modules/rxjs';

import * as k3d from '../k3d/k3d';
import * as k3dCloudProvider from '../providers/cloudProvider';

import { ClusterCreateSettings, getNewClusterSettingsFromLast } from './createClusterSettings';
import * as form from './createClusterForm';

import { logChannel } from '../utils/log';
import { shell, ProcessTrackingEvent } from '../utils/shell';
import { succeeded, Errorable } from '../utils/errorable';
import { longRunningWithMessages, ProgressStep, ProgressUpdate } from '../utils/host';
import { Cancellable } from '../utils/cancellable';
import * as webview from '../utils/webview';
import { cantHappen } from '../utils/never';


// entrypoint for the "k3d: create cluster" command
export async function onCreateCluster(target?: any): Promise<void> {
    const defaults = getNewClusterSettingsFromLast();
    const settings = await promptClusterSettings(defaults);
    if (settings.cancelled) {
        return;
    }

    if (target) {
        await createClusterInteractive(settings.value);
        return;
    }

    await createClusterInteractive(settings.value);
}

// entrypoint for the "k3d: create cluster (with last settings)" command
export async function onCreateClusterLast(target?: any): Promise<void> {
    const settings = getNewClusterSettingsFromLast();

    if (target) {
        await createClusterInteractive(settings);
        return;
    }
    await createClusterInteractive(settings);
}

async function createClusterInteractive(settings: ClusterCreateSettings): Promise<void> {

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

    const progressSteps = k3d.createCluster(shell, settings, undefined).pipe(
        map((e) => createClusterProgressOf(e))
    );

    await displayClusterCreationUI(progressSteps);

    // refresh the views
    vscode.commands.executeCommand("extension.vsKubernetesRefreshExplorer");
    vscode.commands.executeCommand("extension.vsKubernetesRefreshCloudExplorer");
}

function undecorateClusterCreationOutput<T>(events: Observable<ProgressStep<T>>): Observable<ProgressStep<T>> {
    const interestingUpdatePrefix = '• ';

    const stripPrefix = (e: ProgressUpdate) => ({
        type: 'update' as const,
        message: e.message.substring(interestingUpdatePrefix.length)
    } as ProgressUpdate);

    const isIgnorableUpdate = (e: ProgressStep<T>) => e.type === 'update' && !e.message.startsWith(interestingUpdatePrefix);
    const undecorate = (e: ProgressStep<T>) => e.type === 'update' ? stripPrefix(e) : e;

    return events.pipe(
        filter((e) => !isIgnorableUpdate(e)),
        map((e) => undecorate(e))
    );
}

export async function displayClusterCreationUI(progressSteps: Observable<ProgressStep<Errorable<null>>>): Promise<void> {
    const progressToDisplay = undecorateClusterCreationOutput(progressSteps);
    const result = await longRunningWithMessages("Creating k3d cluster", progressToDisplay);

    async function displayClusterCreationResult(result: Errorable<null>): Promise<void> {
        if (succeeded(result)) {
            await Promise.all([
                vscode.window.showInformationMessage("Created k3d cluster"),
                k3dCloudProvider.refresh()
            ]);
        } else {
            await vscode.window.showErrorMessage(`Creating k3d cluster failed: ${result.error[0]}`);
        }
    }

    await displayClusterCreationResult(result);
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////
// cluster settings dialog
////////////////////////////////////////////////////////////////////////////////////////////////////////////

async function promptClusterSettings(defaults: ClusterCreateSettings): Promise<Cancellable<ClusterCreateSettings>> {
    const formResult = await webview.showHTMLForm(
        "extension.vsKubernetesK3DCreate",
        "Create k3d cluster",
        form.getCreateClusterForm(defaults),
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
