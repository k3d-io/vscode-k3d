"use strict";

import { Octokit } from "@octokit/rest";
import * as fs from "fs";
import { mkdirp } from "mkdirp";
import * as path from "path";
import * as vscode from "vscode";
import * as download from "./downloads";

import { getInstallFolder, platformUrlString } from "./installationlayout";

import * as config from "../utils/config";
import { Errorable, failed } from "../utils/errorable";
import { refreshKubernetesToolsViews } from "../utils/host";
import { logChannel } from "../utils/log";
import * as shell from "../utils/shell";

const octokit = new Octokit();

// the base URL for downloading the executable
const updateExeURLBase = "https://github.com/k3d-io/k3d/releases/download";

export enum EnsureMode {
    Alert,
    Silent,
}

export function getOrInstallK3D(mode: EnsureMode): Errorable<string> {
    const configuredBin: string | undefined = config.getK3DConfigPathFor("k3d");
    if (configuredBin) {
        if (fs.existsSync(configuredBin)) {
            return { succeeded: true, result: configuredBin };
        }

        if (mode === EnsureMode.Alert) {
            vscode.window
                .showErrorMessage(
                    `${configuredBin} binary (specified in config file) does not exist!`,
                    "Install k3d"
                )
                .then((str) => {
                    if (str === "Install k3d") {
                        return installK3D();
                    }
                });
        }

        return {
            succeeded: false,
            error: [`${configuredBin} does not exist!`],
        };
    }

    const k3dFullPath = shell.which("k3d");
    if (k3dFullPath) {
        logChannel.appendLine(`[installer] already found at ${k3dFullPath}`);
        return { succeeded: true, result: k3dFullPath };
    }

    logChannel.appendLine(`[installer] k3d binary not found`);

    if (mode === EnsureMode.Alert) {
        vscode.window
            .showErrorMessage(`Could not find k3d binary.`, "Install k3d")
            .then((str) => {
                if (str === "Install k3d") {
                    return installK3D();
                }
            });
    }

    logChannel.appendLine(
        `[installer] k3d not found and we did not try to install it`
    );
    return { succeeded: false, error: [`k3d not found.`] };
}

// installK3D installs K3D in a tools directory, updating the config
// for pointing to this file
export async function installK3D(): Promise<Errorable<string>> {
    const tool = "k3d";

    // calculate the remove URL for the executable we want to download
    const binFileExtension = shell.isUnix() ? "" : ".exe";
    const platform = shell.platform();
    const os = platformUrlString(platform);
    const remoteExe = `k3d-${os}-amd64${binFileExtension}`;

    const version = await getLatestK3DVersionAvailable();
    if (failed(version)) {
        return { succeeded: false, error: version.error };
    }

    // final URL where the executable is located
    const k3dExeURL = `${updateExeURLBase}/${version.result.trim()}/${remoteExe}`;

    // calculate the local destination for the executable
    const localBinFile = shell.isUnix() ? "k3d" : "k3d.exe";
    const installFolder = getInstallFolder(tool);
    mkdirp.sync(installFolder);

    const downloadFile = path.join(installFolder, localBinFile);

    logChannel.appendLine(
        `[installer] downloading ${k3dExeURL} to ${downloadFile}`
    );
    const downloadResult = await download.to(k3dExeURL, downloadFile);
    if (failed(downloadResult)) {
        return {
            succeeded: false,
            error: [
                `Failed to download kubectl from ${k3dExeURL}: ${downloadResult.error[0]}`,
            ],
        };
    }

    if (shell.isUnix()) {
        fs.chmodSync(downloadFile, "0777");
    }

    // update the config for pointing to this file
    await config.addPathToConfig(
        config.toolPathOSKey(platform, tool),
        downloadFile
    );

    logChannel.appendLine(`[installer] k3d installed successfully`);
    refreshKubernetesToolsViews();

    return { succeeded: true, result: downloadFile };
}

// getLatestK3DVersionAvailable gets the latest version of K3D from GitHub
async function getLatestK3DVersionAvailable(): Promise<Errorable<string>> {
    const updateChannel = config.getK3DConfigUpdateChannel();

    let latestVersion: string;
    switch (updateChannel) {
        case config.UpdateChannel.Stable:
            const release = await octokit.repos.getLatestRelease({
                owner: "rancher",
                repo: "k3d",
            });
            latestVersion = release.data.tag_name;
            break;

        case config.UpdateChannel.All:
            const releases = await octokit.repos.listReleases({
                owner: "rancher",
                repo: "k3d",
            });
            latestVersion = releases.data[0].tag_name;
            break;

        default:
            latestVersion = "";
            break;
    }

    logChannel.appendLine(
        `[installer] found latest version ${latestVersion} from GitHub relases`
    );
    return { succeeded: true, result: latestVersion };
}
