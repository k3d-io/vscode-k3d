import * as vscode from 'vscode';
import * as k8s from 'vscode-kubernetes-tools-api';

import { Observable } from '../../node_modules/rxjs';

export async function selectWorkspaceFolder(placeHolder?: string): Promise<vscode.WorkspaceFolder | undefined> {
    const folders = vscode.workspace.workspaceFolders;

    if (!folders || folders.length === 0) {
        vscode.window.showErrorMessage("This command requires an open folder");
        return undefined;
    }

    if (folders.length === 1) {
        return folders[0];
    }

    return await vscode.window.showWorkspaceFolderPick({ placeHolder: placeHolder });
}

export async function selectQuickPick<T extends vscode.QuickPickItem>(items: T[], options?: vscode.QuickPickOptions): Promise<T | undefined> {
    if (items.length === 1) {
        return items[0];
    }
    return await vscode.window.showQuickPick(items, options);
}

export async function longRunning<T>(title: string, action: () => Promise<T>): Promise<T> {
    const options = {
        location: vscode.ProgressLocation.Notification,
        title: title
    };
    return await vscode.window.withProgress(options, (_) => action());
}

export interface ProgressUpdate {
    readonly type: 'update';
    readonly message: string;
}

export interface ProgressComplete<T> {
    readonly type: 'complete';
    readonly value: T;
}

export type ProgressStep<T> = ProgressUpdate | ProgressComplete<T>;

export async function longRunningWithMessages<T>(title: string, progressSteps: Observable<ProgressStep<T>>): Promise<T> {
    const options = {
        location: vscode.ProgressLocation.Notification,
        title: title
    };

    function runAction(progress: vscode.Progress<{ message?: string; increment?: number}>, _token: vscode.CancellationToken): Promise<T> {
        const promise = new Promise<T>((resolve, reject) => {
            progressSteps.subscribe(
                (progressStep) => {
                    if (progressStep.type === 'update') {
                        if (progressStep.message && progressStep.message.length > 0) {
                            progress.report({ message: progressStep.message });
                        }
                    } else if (progressStep.type === 'complete') {
                        resolve(progressStep.value);
                    }
                },
                (error) => reject(error)
            );
        });
        return promise;
    }

    return await vscode.window.withProgress(options, runAction);
}

export async function confirm(text: string, confirmLabel: string): Promise<boolean> {
    const choice = await vscode.window.showWarningMessage(text, confirmLabel, 'Cancel');
    return choice === confirmLabel;
}

export async function refreshInstallationExplorer(): Promise<void> {
    await vscode.commands.executeCommand("duffle.refreshInstallationExplorer");
}

export async function refreshBundleExplorer(): Promise<void> {
    await vscode.commands.executeCommand("duffle.refreshBundleExplorer");
}

export async function refreshRepoExplorer(): Promise<void> {
    await vscode.commands.executeCommand("duffle.refreshRepoExplorer");
}

export async function refreshCredentialExplorer(): Promise<void> {
    await vscode.commands.executeCommand("duffle.refreshCredentialExplorer");
}

export async function refreshKubernetesToolsViews(): Promise<void> {
    const cloudExplorer = await k8s.extension.cloudExplorer.v1;
    if (cloudExplorer.available) {
        cloudExplorer.api.refresh();
    }

    const clusterExplorer = await k8s.extension.clusterExplorer.v1;
    if (clusterExplorer.available) {
        clusterExplorer.api.refresh();
    }
}
