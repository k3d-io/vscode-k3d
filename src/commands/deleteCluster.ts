import * as vscode from "vscode";

import * as k3d from "../k3d/k3d";

import { tryResolveClusterNode, promptCluster } from "./utils";

import { shell } from "../utils/shell";
import { Errorable, succeeded } from "../utils/errorable";
import { longRunning, confirm } from "../utils/host";
import { refreshKubernetesToolsViews } from "../utils/host";

export async function onDeleteCluster(target?: any): Promise<void> {
    if (target) {
        await deleteCluster(target);
    } else {
        await deleteClusterInteractive();
    }
}

async function deleteCluster(target: any): Promise<void> {
    const clusterNode = await tryResolveClusterNode(target);
    if (!clusterNode) {
        return; // should never happen
    }
    await deleteClusterByName(clusterNode.clusterName);
}

async function deleteClusterInteractive(): Promise<void> {
    const clusterName = await promptCluster(
        "Cluster to delete",
        "Getting existing clusters..."
    );
    if (!clusterName) {
        return;
    }
    await deleteClusterByName(clusterName);
}

// deleteClusterByName will be invoked when users click on "Delete cluster"
export async function deleteClusterByName(
    clusterName: string,
    askUser = true
): Promise<void> {
    if (askUser) {
        const confirmed = await confirm(
            `This will delete "${clusterName}". You will not be able to undo this.`,
            "Delete cluster"
        );
        if (!confirmed) {
            return;
        }
    }

    const result = await longRunning(
        `Deleting cluster "${clusterName}"...`,
        () => k3d.deleteCluster(shell, clusterName)
    );

    await displayClusterDeletionResult(result, clusterName);
}

// displayClusterDeletionResult displais the results of the cluster destruction
async function displayClusterDeletionResult(
    result: Errorable<null>,
    clusterName: string
): Promise<void> {
    if (succeeded(result)) {
        await Promise.all([
            vscode.window.showInformationMessage(
                `Deleted cluster "${clusterName}"`
            ),
            refreshKubernetesToolsViews(),
        ]);
    } else {
        await vscode.window.showErrorMessage(
            `Deleting cluster "${clusterName}" failed: ${result.error[0]}`
        );
    }
}
