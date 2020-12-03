import * as vscode from 'vscode';

import { map, filter } from 'rxjs/operators';

import * as k3d from '../k3d/k3d';
import * as k3dCloudProvider from '../providers/cloud-provider';

import { ClusterCreateSettings } from '../k3d/k3d';

import { shell, ProcessTrackingEvent } from '../utils/shell';
import { succeeded, Errorable } from '../utils/errorable';
import { longRunningWithMessages, ProgressStep, ProgressUpdate } from '../utils/host';
import { Cancellable } from '../utils/cancellable';
import { showHTMLForm } from '../utils/webview';
import { cantHappen } from '../utils/never';

import { Observable } from '../../node_modules/rxjs';

export async function onCreateCluster(target?: any): Promise<void> {
    const settings = await promptClusterSettings();
    if (settings.cancelled) {
        return;
    }

    if (target) {
        await createClusterInteractive(settings.value);
        return;
    }

    await createClusterInteractive(settings.value);
}

async function createClusterInteractive(settings: ClusterCreateSettings): Promise<void> {
    const progressSteps = k3d.createCluster(shell, settings, undefined).pipe(
        map((e) => createClusterProgressOf(e))
    );

    await displayClusterCreationUI(progressSteps);
}

// createClusterProgressOf is invoked for processing each line of output from `k3d cluster create`
function createClusterProgressOf(e: ProcessTrackingEvent): ProgressStep<Errorable<null>> {
    if (e.eventType === 'line') {
        return { type: 'update', message: e.text };
    } else if (e.eventType === 'succeeded') {
        return { type: 'complete', value: { succeeded: true, result: null } };
    } else if (e.eventType === 'failed') {
        return { type: 'complete', value: { succeeded: false, error: [e.stderr] } };
    } else {
        return cantHappen(e);
    }
}

function undecorateClusterCreationOutput<T>(events: Observable<ProgressStep<T>>): Observable<ProgressStep<T>> {
    const interestingUpdatePrefix = '• ';
    const stripPrefix = (e: ProgressUpdate) => ({ type: 'update' as const, message: e.message.substring(interestingUpdatePrefix.length) } as ProgressUpdate);
    const isIgnorableUpdate = (e: ProgressStep<T>) => e.type === 'update' && !e.message.startsWith(interestingUpdatePrefix);
    const undecorate = (e: ProgressStep<T>) => e.type === 'update' ? stripPrefix(e) : e;
    return events.pipe(
        filter((e) => !isIgnorableUpdate(e)),
        map((e) => undecorate(e))
    );
}

async function displayClusterCreationUI(progressSteps: Observable<ProgressStep<Errorable<null>>>): Promise<void> {
    const progressToDisplay = undecorateClusterCreationOutput(progressSteps);
    const result = await longRunningWithMessages("Creating k3d cluster", progressToDisplay);
    await displayClusterCreationResult(result);
}

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

////////////////////////////////////////////////////////////////////////////////////////////////////////////
// cluster settings dialog
////////////////////////////////////////////////////////////////////////////////////////////////////////////

async function promptClusterSettings(): Promise<Cancellable<ClusterCreateSettings>> {
    const formResult = await showHTMLForm("k3d.createCluster",
        "Create k3d cluster",
        k3d.createClusterHTML,
        "Create Cluster");
    if (formResult.cancelled) {
        return formResult;
    }

    return {
        cancelled: false,
        value: k3d.createClusterSettingsFromForm(formResult.value)
    };
}
