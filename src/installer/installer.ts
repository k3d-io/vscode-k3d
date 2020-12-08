'use strict';

import * as vscode from 'vscode';
import * as download from './downloads';
import * as fs from 'fs';
import * as path from 'path';
import mkdirp = require('mkdirp');
import * as shell from '../utils/shell';
import { logChannel } from '../utils/log';
import { Errorable, failed } from '../utils/errorable';
import { addPathToConfig, toolPathOSKey } from '../utils/config';
import { platformUrlString, getConfigK3DToolPath, getInstallFolder } from './installationlayout';

export enum EnsureMode {
    Alert,
    Silent,
}

export function getOrInstallK3D(mode: EnsureMode): Errorable<string> {
    const configuredBin: string | undefined = getConfigK3DToolPath('k3d');
    if (configuredBin) {
        if (fs.existsSync(configuredBin)) {
            return {
                succeeded: true,
                result: configuredBin
            };
        }

        if (mode === EnsureMode.Alert) {
            vscode.window.showErrorMessage(`${configuredBin} binary (specified in config file) does not exist!`,
                "Install k3d").then((str) => {
                    if (str === "Install k3d") {
                        return installK3D();
                    }
                });
        }

        return {
            succeeded: false,
            error: [`${configuredBin} does not exist!`]
        };
    }

    const k3dFullPath = shell.which("k3d");
    if (k3dFullPath) {
        logChannel.appendLine(`[installer] already found at ${k3dFullPath}`);
        return {
            succeeded: true,
            result: k3dFullPath
        };
    }

    logChannel.appendLine(`[installer] k3d binary not found`);

    if (mode === EnsureMode.Alert) {
        vscode.window.showErrorMessage(`Could not find k3d binary.`,
            "Install k3d").then((str) => {
                if (str === "Install k3d") {
                    return installK3D();
                }
            });
    }

    logChannel.appendLine(`[installer] k3d not found and we did not try to install it`);
    return {
        succeeded: false,
        error: [`k3d not found.`]
    };
}

// installK3D installs K3D in a tools directory, updating the config
// for pointing to this file
export async function installK3D(): Promise<Errorable<string>> {
    const tool = 'k3d';
    const binFile = (shell.isUnix()) ? 'k3d' : 'k3d.exe';
    const binFileExtension = (shell.isUnix()) ? '' : '.exe';
    const platform = shell.platform();
    const os = platformUrlString(platform);

    const version = await getStableK3DVersion();
    if (failed(version)) {
        return {
            succeeded: false,
            error: version.error
        };
    }

    const installFolder = getInstallFolder(tool);
    mkdirp.sync(installFolder);

    const k3dUrl = `https://github.com/rancher/k3d/releases/download/${version.result.trim()}/k3d-${os}-amd64${binFileExtension}`;
    const downloadFile = path.join(installFolder, binFile);

    logChannel.appendLine(`[installer] downloading ${k3dUrl} to ${downloadFile}`);
    const downloadResult = await download.to(k3dUrl, downloadFile);
    if (failed(downloadResult)) {
        return {
            succeeded: false,
            error: [`Failed to download kubectl: ${downloadResult.error[0]}`]
        };
    }

    if (shell.isUnix()) {
        fs.chmodSync(downloadFile, '0777');
    }

    // update the config for pointing to this file
    await addPathToConfig(toolPathOSKey(platform, tool), downloadFile);

    logChannel.appendLine(`[installer] k3d installed successfully`);

    // refresh the views
    vscode.commands.executeCommand("extension.vsKubernetesRefreshExplorer");
    vscode.commands.executeCommand("extension.vsKubernetesRefreshCloudExplorer");

    return {
        succeeded: true,
        result: downloadFile
    };
}

// getStableK3DVersion gets the latest version of K3D from GitHub
async function getStableK3DVersion(): Promise<Errorable<string>> {
    const downloadResult = await download.toTempFile('https://api.github.com/repos/rancher/k3d/releases/latest');
    if (failed(downloadResult)) {
        return {
            succeeded: false,
            error: [`Failed to find k3d stable version: ${downloadResult.error[0]}`]
        };
    }

    const versionObj = JSON.parse(fs.readFileSync(downloadResult.result, 'utf-8'));
    fs.unlinkSync(downloadResult.result);

    const v = versionObj['tag_name'];
    logChannel.appendLine(`[installer] found latest version ${v} from GitHub relases`);
    return {
        succeeded: true,
        result: v
    };
}
