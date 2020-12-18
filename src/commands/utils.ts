import * as vscode from 'vscode';
import * as k8s from 'vscode-kubernetes-tools-api';

import { K3dCloudProviderTreeNode, K3dCloudProviderClusterNode } from '../providers/cloudProvider';

import * as k3d from '../k3d/k3d';

import { longRunning } from '../utils/host';
import { shell } from '../utils/shell';
import { failed } from '../utils/errorable';

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

export async function promptCluster(prompt: string, progressMessage: string): Promise<string | undefined> {
    const clusters = await longRunning(progressMessage, () => k3d.getClusters(shell));
    if (failed(clusters)) {
        return await vscode.window.showInputBox({ prompt: prompt });
    } else {
        if (clusters.result.length === 0) {
            await vscode.window.showErrorMessage(`No K3d clusters running`);
            return undefined;
        } else {
            return await vscode.window.showQuickPick(clusters.result.map((c) => c.name));
        }
    }
}
