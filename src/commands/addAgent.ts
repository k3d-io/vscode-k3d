import * as vscode from 'vscode';

import * as k3d from '../k3d/k3d';

import { tryResolveClusterNode, promptCluster } from './utils';

import { shell } from '../utils/shell';
import { Errorable, succeeded } from '../utils/errorable';
import { longRunning } from '../utils/host';
import { refreshKubernetesToolsViews } from '../utils/vscode';

export async function onAddAgent(target?: any): Promise<void> {
    if (target) {
        await addAgent(target);
    } else {
        await addAgentInteractive();
    }
}

async function addAgent(target: any): Promise<void> {
    const clusterNode = await tryResolveClusterNode(target);
    if (!clusterNode) {
        return;  // should never happen
    }
    await addAgentNodeToCluster(clusterNode.clusterName);
}

async function addAgentInteractive(): Promise<void> {
    const clusterName = await promptCluster('Cluster name', 'Getting existing clusters...');
    if (!clusterName) {
        return;
    }
    await addAgentNodeToCluster(clusterName);
}

// addAgentByName will be invoked when users click on "Add agent"
async function addAgentNodeToCluster(clusterName: string): Promise<void> {
    const max = 1000;
    const randInt = Math.floor(Math.random() * (max + 1));
    const nodeName = `agent-${randInt}`;
    const result = await longRunning(`Adding agent "${nodeName}" to "${clusterName}"...`,
        () => k3d.addAgentTo(shell, clusterName, nodeName));

    displayAddAgentDeletionResult(result, clusterName, nodeName);
}

// displayAddAgentDeletionResult displais the results of adding an agent to the cluster
async function displayAddAgentDeletionResult(result: Errorable<string>, clusterName: string, nodeName: string): Promise<void> {
    if (succeeded(result)) {
        await Promise.all([
            vscode.window.showInformationMessage(`Agent node "${nodeName}" successfully added to cluster "${clusterName}"`),
            refreshKubernetesToolsViews()
        ]);
    } else {
        await vscode.window.showErrorMessage(`Could not add agent node "${nodeName}" to cluster "${clusterName}": ${result.error[0]}`);
    }
}
