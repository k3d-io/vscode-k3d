import * as vscode from 'vscode';

import * as k3d from '../k3d/k3d';

import { tryResolveClusterNode, promptCluster, promptNodesInCluster } from './utils';

import { shell } from '../utils/shell';
import { longRunning } from '../utils/host';
import { displayNodeOperationResult } from './utils';

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
        () => k3d.deleteNodeFrom(shell, clusterName, nodeName));

    displayNodeOperationResult(result, clusterName, nodeName, "deleted");
}
