import * as k8s from "vscode-kubernetes-tools-api";
import * as vscode from "vscode";

import { Context } from "./utils/context";

import { K3D_CLUSTER_PROVIDER } from "./providers/clusterProvider";
import { K3D_CLOUD_PROVIDER } from "./providers/cloudProvider";

import { onCreateCluster, onCreateClusterLast } from "./commands/createCluster";
import { onDeleteCluster } from "./commands/deleteCluster";
import { onAddAgent } from "./commands/addAgent";
import { onDeleteAgent } from "./commands/deleteAgent";
import { onAddServer } from "./commands/addServer";
import { onDeleteServer } from "./commands/deleteServer";
import {
    onReplaceCluster,
    onReplaceClusterLast,
} from "./commands/replaceCluster";

export async function activate(context: vscode.ExtensionContext) {
    Context.register(context);

    const clusterProvider = await k8s.extension.clusterProvider.v1;
    if (clusterProvider.available) {
        clusterProvider.api.register(K3D_CLUSTER_PROVIDER);
    } else {
        vscode.window.showErrorMessage(
            "Can't register k3d cluster provider: " + clusterProvider.reason
        );
    }

    const cloudExplorer = await k8s.extension.cloudExplorer.v1;
    if (cloudExplorer.available) {
        cloudExplorer.api.registerCloudProvider(K3D_CLOUD_PROVIDER);
    } else {
        vscode.window.showErrorMessage(
            "Can't register k3d cloud provider: " + cloudExplorer.reason
        );
    }

    const disposables = [
        // Create/destroy clusters
        vscode.commands.registerCommand(
            "extension.vsKubernetesK3DCreate",
            onCreateCluster
        ),
        vscode.commands.registerCommand(
            "extension.vsKubernetesK3DCreateLast",
            onCreateClusterLast
        ),
        vscode.commands.registerCommand(
            "extension.vsKubernetesK3DDelete",
            onDeleteCluster
        ),

        // Replace clusters
        vscode.commands.registerCommand(
            "extension.vsKubernetesK3DReplace",
            onReplaceCluster
        ),
        vscode.commands.registerCommand(
            "extension.vsKubernetesK3DReplaceLast",
            onReplaceClusterLast
        ),

        // Add/remove agents
        vscode.commands.registerCommand(
            "extension.vsKubernetesK3DAddAgent",
            onAddAgent
        ),
        vscode.commands.registerCommand(
            "extension.vsKubernetesK3DDeleteAgent",
            onDeleteAgent
        ),

        // Add/remove servers
        vscode.commands.registerCommand(
            "extension.vsKubernetesK3DAddServer",
            onAddServer
        ),
        vscode.commands.registerCommand(
            "extension.vsKubernetesK3DDeleteServer",
            onDeleteServer
        ),
    ];

    context.subscriptions.push(...disposables);
}
