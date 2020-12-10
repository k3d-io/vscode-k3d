
import { Observable, throwError } from 'rxjs';

import { Errorable, failed } from '../utils/errorable';
import * as shell from '../utils/shell';
import { K3dClusterInfo } from "./k3d.objectmodel";
import { logChannel } from '../utils/log';
import '../utils/array';

import { ClusterCreateSettings, createClusterArgsFromSettings } from '../commands/createClusterSettings';
import { getOrInstallK3D, EnsureMode } from '../installer/installer';

async function invokeK3DCommandObj<T>(sh: shell.Shell, command: string, args: string, opts: shell.ExecOpts, fn: (stdout: string) => T): Promise<Errorable<T>> {
    const k3dExe = getOrInstallK3D(EnsureMode.Alert);
    if (failed(k3dExe)) {
        return k3dExe;
    }
    const exe = k3dExe.result;

    const cmd = `${exe} ${command} ${args}`;
    logChannel.appendLine(`$ ${cmd}`);

    function andLog<T>(fn: (s: string) => T): (s: string) => T {
        return (s: string) => {
            logChannel.appendLine(s);
            return fn(s);
        };
    }

    return await sh.execObj<T>(cmd, `${exe} ${command}`, opts, andLog(fn));
}

function invokeTracking(sh: shell.Shell, command: string, ...args: string[]): Observable<shell.ProcessTrackingEvent> {
    const k3dExe = getOrInstallK3D(EnsureMode.Alert);
    if (failed(k3dExe)) {
        return throwError(new Error(k3dExe.error[0]));
    }
    const exe = k3dExe.result;

    const cmd = [...(command.split(' ')), ...args];
    logChannel.appendLine(`$ ${exe} ${cmd.join(' ')}`);
    return sh.execTracking(exe, cmd);
}

///////////////////////////////////////////////////////////////////////////////
// create cluster
///////////////////////////////////////////////////////////////////////////////

export function createCluster(sh: shell.Shell, settings: ClusterCreateSettings, configFilePath: string | undefined): Observable<shell.ProcessTrackingEvent> {
    const args: string[] = createClusterArgsFromSettings(settings);
    if (settings.name) {
        return invokeTracking(sh, 'cluster create', settings.name, ...args);
    } else {
        logChannel.appendLine(`[ERROR] no cluster name provided in 'createCluster'`);
        return throwError(new Error(`[ERROR] no cluster name provided in 'createCluster'`));
    }
}

///////////////////////////////////////////////////////////////////////////////
// delete cluster
///////////////////////////////////////////////////////////////////////////////

export function deleteCluster(sh: shell.Shell, clusterName: string): Promise<Errorable<null>> {
    return invokeK3DCommandObj(sh, 'cluster delete', `${clusterName}`, {}, (_) => null);
}

///////////////////////////////////////////////////////////////////////////////
// list clusters
///////////////////////////////////////////////////////////////////////////////

// getClusters gets the list of current K3D clusters
export async function getClusters(sh: shell.Shell): Promise<Errorable<K3dClusterInfo[]>> {
    function parse(stdout: string): K3dClusterInfo[] {
        return JSON.parse(stdout)
            .map((l: any) => ({ name: l.name }))
            .orderBy((c: K3dClusterInfo) => c.name);
    }
    return invokeK3DCommandObj(sh, 'cluster list -o json', '', {}, parse);
}

///////////////////////////////////////////////////////////////////////////////
// get kubeconfig
///////////////////////////////////////////////////////////////////////////////

export async function getKubeconfig(sh: shell.Shell, clusterName: string): Promise<Errorable<string>> {
    return invokeK3DCommandObj(sh, `kubeconfig get`, `${clusterName}`, {}, (s) => s);
}

///////////////////////////////////////////////////////////////////////////////
// version
///////////////////////////////////////////////////////////////////////////////

export async function version(sh: shell.Shell): Promise<Errorable<string>> {
    return invokeK3DCommandObj(sh, `version`, '', {}, (s) => s.trim());
}
