import * as vscode from 'vscode';

import * as k3d from '../k3d/k3d';

import { tryResolveClusterNode, promptCluster, promptNodesInCluster } from './utils';

import { shell } from '../utils/shell';
import { longRunning } from '../utils/host';
import { displayNodeOperationResult } from './utils';

export async function onDeleteServer(target?: any): Promise<void> {
    if (target) {
        try {
            if (target.value.nodeType === "node") {
                performDeleteServerNodeToCluster(target.value.nodeName, target.value.clusterName);
            }
        } catch (error) {
            // pass
        }

        await deleteServer(target);
    } else {
        await deleteServerInteractive();
    }
}

async function deleteServer(target: any): Promise<void> {
    const clusterNode = await tryResolveClusterNode(target);
    if (!clusterNode) {
        return;  // should never happen
    }
    await deleteServerNodeToCluster(clusterNode.clusterName);
}

async function deleteServerInteractive(): Promise<void> {
    const clusterName = await promptCluster('Cluster name', 'Getting existing clusters...');
    if (!clusterName) {
        return;
    }
    await deleteServerNodeToCluster(clusterName);
}

// deleteServerByName will be invoked when users click on "Delete server"
async function deleteServerNodeToCluster(clusterName: string): Promise<void> {
    const nodeName = await promptNodesInCluster(clusterName, "server", "Server node", "Getting existing nodes...");
    if (nodeName === undefined) {
        await vscode.window.showErrorMessage(`Could not get an server node in cluster "${clusterName}"`);
        return;
    }

    performDeleteServerNodeToCluster(nodeName, clusterName);
}

// deleteServerByName will be invoked when users click on "Delete server"
async function performDeleteServerNodeToCluster(nodeName: string, clusterName: string): Promise<void> {
    const result = await longRunning(`Deleting server node "${nodeName}" from "${clusterName}"...`,
        () => k3d.deleteNodeFrom(shell, clusterName, nodeName));

    displayNodeOperationResult(result, clusterName, nodeName, "deleted");
}
