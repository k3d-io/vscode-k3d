import * as k8s from 'vscode-kubernetes-tools-api';
import * as vscode from 'vscode';

import { K3D_CLUSTER_PROVIDER } from './providers/cluster-provider';
import { K3D_CLOUD_PROVIDER } from './providers/cloud-provider';

import { onCreateCluster } from './commands/create-cluster';
import { onDeleteCluster } from './commands/delete-cluster';

export async function activate(context: vscode.ExtensionContext) {
    const clusterProvider = await k8s.extension.clusterProvider.v1;
    if (clusterProvider.available) {
        clusterProvider.api.register(K3D_CLUSTER_PROVIDER);
    } else {
        vscode.window.showErrorMessage("Can't register k3d cluster provider: " + clusterProvider.reason);
    }

    const cloudExplorer = await k8s.extension.cloudExplorer.v1;
    if (cloudExplorer.available) {
        cloudExplorer.api.registerCloudProvider(K3D_CLOUD_PROVIDER);
    } else {
        vscode.window.showErrorMessage("Can't register k3d cloud provider: " + cloudExplorer.reason);
    }

    const disposables = [
        vscode.commands.registerCommand("k3d.createCluster", onCreateCluster),
        vscode.commands.registerCommand("k3d.deleteCluster", onDeleteCluster),
    ];

    context.subscriptions.push(...disposables);
}
