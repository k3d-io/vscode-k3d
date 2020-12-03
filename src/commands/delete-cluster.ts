import * as vscode from 'vscode';
import * as k8s from 'vscode-kubernetes-tools-api';

import * as k3d from '../k3d/k3d';
import * as k3dCloudProvider from '../providers/cloud-provider';
import { shell } from '../utils/shell';
import { failed, Errorable, succeeded } from '../utils/errorable';
import { longRunning, confirm } from '../utils/host';
import { K3dCloudProviderTreeNode, K3dCloudProviderClusterNode } from '../providers/cloud-provider';

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
        return;  // should never happen
    }
    await deleteClusterByName(clusterNode.clusterName);
}

async function deleteClusterInteractive(): Promise<void> {
    const clusterName = await promptCluster('Getting existing clusters...');
    if (!clusterName) {
        return;
    }
    await deleteClusterByName(clusterName);
}

// deleteClusterByName will be invoked when users click on "Delete cluster"
async function deleteClusterByName(clusterName: string): Promise<void> {
    const confirmed = await confirm(`This will delete ${clusterName}. You will not be able to undo this.`,
        'Delete cluster');
    if (!confirmed) {
        return;
    }

    const result = await longRunning(`Deleting cluster ${clusterName}...`,
        () => k3d.deleteCluster(shell, clusterName));

    // TODO: remove from kubeconfig?
    await displayClusterDeletionResult(result, clusterName);
}

async function displayClusterDeletionResult(result: Errorable<null>, clusterName: string): Promise<void> {
    if (succeeded(result)) {
        await Promise.all([
            vscode.window.showInformationMessage(`Deleted cluster ${clusterName}`),
            k3dCloudProvider.refresh()
        ]);
    } else {
        await vscode.window.showErrorMessage(`Deleting K3d cluster failed: ${result.error[0]}`);
    }
}

async function promptCluster(progressMessage: string): Promise<string | undefined> {
    const clusters = await longRunning(progressMessage, () => k3d.getClusters(shell));
    if (failed(clusters)) {
        return await vscode.window.showInputBox({ prompt: 'Cluster to delete' });
    } else {
        return await vscode.window.showQuickPick(clusters.result.map((c) => c.name));
    }
}

async function tryResolveClusterNode(target: any): Promise<K3dCloudProviderClusterNode | undefined> {
    const cloudExplorer = await k8s.extension.cloudExplorer.v1;
    if (!cloudExplorer.available) {
        return undefined;
    }
    const cloudExplorerNode = cloudExplorer.api.resolveCommandTarget(target);
    if (cloudExplorerNode && cloudExplorerNode.nodeType === 'resource' && cloudExplorerNode.cloudName === 'k3d') {
        const k3dTreeNode: K3dCloudProviderTreeNode = cloudExplorerNode.cloudResource;
        if (k3dTreeNode.nodeType === 'cluster') {
            return k3dTreeNode;
        }
    }
    return undefined;
}
