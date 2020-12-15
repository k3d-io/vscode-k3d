import * as vscode from "vscode";

import * as config from '../utils/config';
import { Context } from '../utils/context';

// Settings used for creating the cluster
export interface ClusterCreateSettings {
    name: string | undefined;
    image: string | undefined;
    numServers: number | undefined;
    numAgents: number | undefined;
    network: string | undefined;
    lb: boolean | undefined;
}

export function createClusterArgsFromSettings(settings: ClusterCreateSettings): string[] {
    const args: string[] = [];

    if (settings.numServers) {
        args.push("--servers", `${settings.numServers}`);
    }
    if (settings.numAgents) {
        args.push("--agents", `${settings.numAgents}`);
    }
    if (settings.image !== "") {
        args.push("--image", `${settings.image}`);
    }
    if (settings.network) {
        args.push("--network", `${settings.network}`);
    }
    if (settings.lb !== undefined) {
        if (!settings.lb) {
            args.push("--no-lb");
        }
    }
    if (config.getK3DCreateClusterConfigUpdateKubeconfig()) {
        args.push("--update-default-kubeconfig");
    }
    return args;
}

////////////////////////////////////////////////////////////////////////

/**
 * An implementation of {@link ClusterSettings} that stores settings
 * using the VS Code memento API.
 */
class MementoClusterSettings implements ClusterCreateSettings {
    private static instance: MementoClusterSettings;

    private readonly nameStorageKey = "k3d-last-name";
    private readonly imageStorageKey = "k3d-last-image";
    private readonly numServersStorageKey = "k3d-last-num-servers";
    private readonly numAgentsStorageKey = "k3d-last-num-agents";
    private readonly netStorageKey = "k3d-last-net";
    private readonly lbStorageKey = "k3d-last-lb";

    private readonly storage: vscode.Memento;

    public constructor(storage: vscode.Memento) {
        this.storage = storage;
    }

    set name(value: string | undefined) {
        this.storage.update(this.nameStorageKey, value);
    }

    get name(): string | undefined {
        const name = this.storage.get<string>(this.nameStorageKey);
        if (name === undefined) {
            return undefined;
        }
        return name;
    }

    set image(value: string | undefined) {
        this.storage.update(this.imageStorageKey, value);
    }

    get image(): string | undefined {
        const value = this.storage.get<string>(this.imageStorageKey);
        if (value === undefined) {
            return undefined;
        }
        return value;
    }

    set numServers(value: number | undefined) {
        this.storage.update(this.numServersStorageKey, value);
    }

    get numServers(): number | undefined {
        const value = this.storage.get<number>(this.numServersStorageKey);
        if (value == undefined) {
            return undefined;
        }
        return value;
    }

    set numAgents(value: number | undefined) {
        this.storage.update(this.numAgentsStorageKey, value);
    }

    get numAgents(): number | undefined {
        const name = this.storage.get<number>(this.numAgentsStorageKey);
        if (name === undefined) {
            return undefined;
        }
        return name;
    }

    set network(value: string | undefined) {
        this.storage.update(this.netStorageKey, value);
    }

    get network(): string | undefined {
        const value = this.storage.get<string>(this.netStorageKey);
        if (value === undefined) {
            return undefined;
        }
        return value;
    }

    set lb(value: boolean | undefined) {
        this.storage.update(this.lbStorageKey, value);
    }

    get lb(): boolean | undefined {
        const value = this.storage.get<boolean>(this.lbStorageKey);
        if (value === undefined) {
            return undefined;
        }
        return value;
    }

    static getInstance(): MementoClusterSettings {
        if (!MementoClusterSettings.instance) {
            MementoClusterSettings.instance = new MementoClusterSettings(Context.current.workspaceState);
        }

        return MementoClusterSettings.instance;
    }
}

export const getLastClusterSettings = (): ClusterCreateSettings => MementoClusterSettings.getInstance();

// save the last settings used for creating a cluster
export function saveLastClusterCreateSettings(s: ClusterCreateSettings) {
    const lcs = getLastClusterSettings();
    lcs.name = s.name;
    lcs.image = s.image;
    lcs.numServers = s.numServers;
    lcs.numAgents = s.numAgents;
}

// create a new ClusterCreateSettings, using the last settings as a
// starting point (but changing some things like a random cluster name)
export function getNewClusterSettingsFromLast(): ClusterCreateSettings {
    const lcs = getLastClusterSettings();

    // clone the settings and fix some things
    var settings: ClusterCreateSettings = { ...lcs };

    const max = 1000;
    const randInt = Math.floor(Math.random() * (max + 1));

    settings.name = `k3d-cluster-${randInt}`;
    if (settings.numServers === undefined) {
        settings.numServers = 1;
    }
    if (settings.numAgents === undefined) {
        settings.numAgents = 0;
    }
    if (settings.image === undefined) {
        settings.image = "";
    }
    if (settings.network === undefined) {
        settings.network = "";
    }
    if (settings.lb === undefined) {
        settings.lb = true;
    }
    return settings;
}
