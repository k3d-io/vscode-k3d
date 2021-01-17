import * as vscode from 'vscode';
import * as k8s from 'vscode-kubernetes-tools-api';

import { K3dCloudProviderTreeNode, K3dCloudProviderClusterNode } from '../providers/cloudProvider';

import * as k3d from '../k3d/k3d';

import { longRunning } from '../utils/host';
import { shell } from '../utils/shell';
import { Errorable, succeeded, failed } from '../utils/errorable';
import { refreshKubernetesToolsViews } from '../utils/host';

export async function tryResolveClusterNode(target: any): Promise<K3dCloudProviderClusterNode | undefined> {
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

// promptCluster prompt users about a cluster,
// showing a list of current clusters available
export async function promptCluster(prompt: string, progressMessage: string): Promise<string | undefined> {
    const clusters = await longRunning(progressMessage, () => k3d.getClusters(shell));
    if (failed(clusters)) {
        return await vscode.window.showInputBox({ prompt: prompt });
    } else {
        if (clusters.result.length === 0) {
            await vscode.window.showErrorMessage(`No K3d clusters running`);
            return undefined;
        } else {
            const clustersNames = clusters.result.map((c) => c.name);

            return await vscode.window.showQuickPick(clustersNames, {
                placeHolder: prompt,
                canPickMany: false,
                ignoreFocusOut: true
            });
        }
    }
}

// promptNodesInCluster prompts users about some node in the cluster,
// showing the list of nodes with a specific role
export async function promptNodesInCluster(
    clusterName: string,
    role: string,
    prompt: string, progressMessage: string): Promise<string | undefined> {

    const clusterInfo = await longRunning(progressMessage, () => k3d.getClusterInfo(shell, clusterName));
    if (failed(clusterInfo)) {
        return await vscode.window.showInputBox({ prompt: prompt });
    } else {
        if (clusterInfo.result.nodes.length === 0) {
            await vscode.window.showErrorMessage(`No K3d clusters running`);
            return undefined;
        } else {
            const agentsNodesList = clusterInfo.result.nodes
                .filter((c) => c.role === role)
                .map((c) => c.name);

            return await vscode.window.showQuickPick(agentsNodesList, {
                placeHolder: prompt,
                canPickMany: false,
                ignoreFocusOut: true
            });
        }
    }
}

// displayNodeOperationResult displais the results of adding/deleting a node to the cluster
export async function displayNodeOperationResult(result: Errorable<string>, clusterName: string, nodeName: string, was: string): Promise<void> {
    if (succeeded(result)) {
        await Promise.all([
            vscode.window.showInformationMessage(`"${nodeName}" successfully ${was} to "${clusterName}"`),
            refreshKubernetesToolsViews()
        ]);
    } else {
        await vscode.window.showErrorMessage(`"${nodeName}" has not be ${was} to "${clusterName}": ${result.error[0]}`);
    }
}
