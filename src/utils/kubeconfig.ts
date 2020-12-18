import * as vscode from 'vscode';
import * as path from 'path';
import * as shelljs from 'shelljs';
import { getUseWsl, VS_KUBE_CFG_KEY } from './config';

const VS_KUBE_KUBECONFIG_CFG_KEY = `${VS_KUBE_CFG_KEY}.kubeconfig`;
const VS_KUBE_KNOWN_KUBECONFIGS_CFG_KEY = `${VS_KUBE_CFG_KEY}.knownKubeconfigs`;

export function getKnownKubeconfigs(): string[] {
    const kkcConfig = vscode.workspace.getConfiguration(VS_KUBE_CFG_KEY)[VS_KUBE_KNOWN_KUBECONFIGS_CFG_KEY];
    if (!kkcConfig || !kkcConfig.length) {
        return [];
    }
    return kkcConfig as string[];
}

export function getActiveKubeconfig(): string {
    return vscode.workspace.getConfiguration(VS_KUBE_CFG_KEY)[VS_KUBE_KUBECONFIG_CFG_KEY];
}

// TODO: I think we could replace this by https://github.com/Azure/vscode-kubernetes-tools/blob/master/docs/extending/configuration.md
export function getKubeconfigPath(): string {
    // If the user specified a kubeconfig path -WSL or not-, let's use it.
    let kubeconfigPath: string | undefined = getActiveKubeconfig();

    if (getUseWsl()) {
        if (!kubeconfigPath) {
            // User is using WSL: we want to use the same default that kubectl uses on Linux ($KUBECONFIG or home directory).
            const result = shelljs.exec('wsl.exe sh -c "${KUBECONFIG:-$HOME/.kube/config}"', { silent: true }) as shelljs.ExecOutputReturnValue;
            if (!result) {
                throw new Error(`Impossible to retrieve the kubeconfig path from WSL. No result from the shelljs.exe call.`);
            }

            if (result.code !== 0) {
                throw new Error(`Impossible to retrieve the kubeconfig path from WSL. Error code: ${result.code}. Error output: ${result.stderr.trim()}`);
            }
            kubeconfigPath = result.stdout.trim();
        }
        return kubeconfigPath;
    }

    if (!kubeconfigPath) {
        kubeconfigPath = process.env['KUBECONFIG'];
    }

    if (!kubeconfigPath) {
        // Fall back on the default kubeconfig value.
        kubeconfigPath = path.join((process.env['HOME'] || process.env['USERPROFILE'] || '.'), ".kube", "config");
    }

    return kubeconfigPath;
}
