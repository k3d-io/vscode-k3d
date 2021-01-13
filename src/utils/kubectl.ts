import * as vscode from "vscode";
import * as k8s from 'vscode-kubernetes-tools-api';

import { logChannel } from "./log";

export interface KubectlContext {
    readonly clusterName: string;
    readonly contextName: string;
    readonly userName: string;
}

export async function deleteClusterFromKubeconfig(context: KubectlContext): Promise<boolean> {
    const kubectl = await k8s.extension.kubectl.v1;
    if (!kubectl.available) {
        vscode.window.showErrorMessage(`Delete ${context.contextName} failed: kubectl is not available. See Output window for more details.`);
        return false;
    }

    const deleteClusterResult = await kubectl.api.invokeCommand(`config delete-cluster ${context.clusterName}`);
    if (deleteClusterResult?.code !== 0) {
        const whatFailed = `Failed to remove the underlying cluster for context ${context.clusterName} from the kubeconfig: ${deleteClusterResult?.stderr}`;
        logChannel.showOutput(whatFailed);

        vscode.window.showWarningMessage(`Failed to remove the underlying cluster for context ${context.contextName}. See Output window for more details.`);
    }

    const deleteUserResult = await kubectl.api.invokeCommand(`config unset users.${context.userName}`);
    if (deleteUserResult?.code !== 0) {
        const whatFailed = `Failed to remove the underlying user for context ${context.contextName} from the kubeconfig: ${deleteUserResult?.stderr}`;
        logChannel.showOutput(whatFailed);
        vscode.window.showWarningMessage(`Failed to remove the underlying user for context ${context.contextName}. See Output window for more details.`);
    }

    const deleteContextResult = await kubectl.api.invokeCommand(`config delete-context ${context.contextName}`);
    if (deleteContextResult?.code !== 0) {
        const whatFailed = `Failed to delete the specified cluster's context ${context.contextName} from the kubeconfig: ${deleteContextResult?.stderr}`;
        logChannel.showOutput(whatFailed);
        vscode.window.showErrorMessage(`Delete ${context.contextName} failed. See Output window for more details.`);
        return false;
    }

    vscode.window.showInformationMessage(`Deleted context '${context.contextName}' and associated data from the kubeconfig.`);
    return true;
}

export async function setContext(contextName: string): Promise<void> {
    const kubectl = await k8s.extension.kubectl.v1;
    if (!kubectl.available) {
        vscode.window.showErrorMessage(`Delete ${contextName} failed: kubectl is not available. See Output window for more details.`);
        return;
    }

    const setContextResult = await kubectl.api.invokeCommand(`config set-context ${contextName}`);
    if (setContextResult?.code !== 0) {
        const whatFailed = `Failed to set "${contextName}": ${setContextResult?.stderr}`;
        logChannel.showOutput(whatFailed);
        vscode.window.showErrorMessage(`Count not set "${contextName}" failed. See Output window for more details.`);
        return;
    }

    vscode.window.showInformationMessage(`Switched to "${contextName}".`);
}

export async function drain(node: string): Promise<string> {
    const kubectl = await k8s.extension.kubectl.v1;
    if (!kubectl.available) {
        vscode.window.showErrorMessage(`Drain ${node} failed: kubectl is not available. See Output window for more details.`);
        return "";
    }

    const drainResult = await kubectl.api.invokeCommand(`drain ${node}`);
    if (drainResult?.code !== 0) {
        const whatFailed = `Failed to drain "${node}": ${drainResult?.stderr}`;
        logChannel.showOutput(whatFailed);
        vscode.window.showErrorMessage(`Count not drain "${node}" failed. See Output window for more details.`);
        return "";
    }

    vscode.window.showInformationMessage(`"${node}" has been drained.`);
    return drainResult.stdout;
}
