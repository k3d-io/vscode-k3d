import * as vscode from 'vscode';

import * as k3d from '../k3d/k3d';

import { tryResolveClusterNode, promptCluster, promptNodesInCluster } from './utils';

import { shell } from '../utils/shell';
import { Errorable, succeeded } from '../utils/errorable';
import { longRunning } from '../utils/host';
import { refreshKubernetesToolsViews } from '../utils/vscode';

export async function onDeleteAgent(target?: any): Promise<void> {
    if (target) {
        await deleteAgent(target);
    } else {
        await deleteAgentInteractive();
    }
}

async function deleteAgent(target: any): Promise<void> {
    const clusterNode = await tryResolveClusterNode(target);
    if (!clusterNode) {
        return;  // should never happen
    }
    await deleteAgentNodeToCluster(clusterNode.clusterName);
}

async function deleteAgentInteractive(): Promise<void> {
    const clusterName = await promptCluster('Cluster name', 'Getting existing clusters...');
    if (!clusterName) {
        return;
    }
    await deleteAgentNodeToCluster(clusterName);
}

// deleteAgentByName will be invoked when users click on "Delete agent"
async function deleteAgentNodeToCluster(clusterName: string): Promise<void> {
    const nodeName = await promptNodesInCluster(clusterName, "agent", "Agent node", "Getting existing nodes...");
    if (nodeName === undefined) {
        await vscode.window.showErrorMessage(`Could not get an agent node in cluster "${clusterName}"`);
        return;
    }

    const result = await longRunning(`Deleting agent node "${nodeName}" from "${clusterName}"...`,
        () => k3d.deleteAgentFrom(shell, clusterName, nodeName));

    displayDeleteAgentDeletionResult(result, clusterName, nodeName);
}

// displayDeleteAgentDeletionResult displays the results of deleting an agent from a cluster
async function displayDeleteAgentDeletionResult(result: Errorable<string>, clusterName: string, nodeName: string): Promise<void> {
    if (succeeded(result)) {
        await Promise.all([
            vscode.window.showInformationMessage(`"${nodeName}" successfully deleted from "${clusterName}"`),
            refreshKubernetesToolsViews()
        ]);
    } else {
        await vscode.window.showErrorMessage(`Could not delete "${nodeName}" from "${clusterName}": ${result.error[0]}`);
    }
}
