import * as path from 'path';

import { Platform } from "../utils/shell";
import * as shell from '../utils/shell';

export function platformUrlString(platform: Platform, supported?: Platform[]): string | null {
    if (supported && supported.indexOf(platform) < 0) {
        return null;
    }
    switch (platform) {
        case Platform.Windows: return 'windows';
        case Platform.MacOS: return 'darwin';
        case Platform.Linux: return 'linux';
        default: return null;
    }
}

export function formatBin(tool: string, platform: Platform): string | null {
    const platformString = platformUrlString(platform);
    if (!platformString) {
        return null;
    }

    const toolPath = `${platformString}-amd64/${tool}`;
    if (platform === Platform.Windows) {
        return toolPath + '.exe';
    }
    return toolPath;
}

export function getInstallFolder(tool: string): string {
    return path.join(shell.home(), `.vs-kubernetes/tools/${tool}`);
}