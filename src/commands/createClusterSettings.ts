import * as vscode from "vscode";

import * as config from "../utils/config";
import { Context } from "../utils/context";

// Settings used for creating the cluster
export interface ClusterCreateSettings {
    name: string | undefined;
    image: string | undefined;
    numServers: number | undefined;
    growServers: boolean | undefined;
    numAgents: number | undefined;
    network: string | undefined;
    lb: boolean | undefined;
    serverArgs: string | undefined;
    createRegistry: boolean | undefined;
    useRegistries: string[] | undefined;
}

// createClusterArgsFromSettings returns a list of arguments for `k3d cluster create`
// for some cluster creation settings
export function createClusterArgsFromSettings(
    settings: ClusterCreateSettings,
    switchContext = true
): string[] {
    const args: string[] = [];

    if (settings.numServers) {
        args.push("--servers", `${settings.numServers}`);
    }
    if (settings.numAgents) {
        args.push("--agents", `${settings.numAgents}`);
    }
    if (settings.image) {
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

    if (settings.serverArgs) {
        settings.serverArgs
            .split(" ")
            .forEach((arg) => args.push("--k3s-server-arg", arg));
    }

    if (settings.createRegistry) {
        args.push("--registry-create");
    } else if (settings.useRegistries && settings.useRegistries.length > 0) {
        args.push("--registry-use", settings.useRegistries.join(","));
    }

    // check if we want to modify the kubeconfig
    const updateKubeconfig = config.getK3DConfigUpdateKubeconfig();
    if (
        updateKubeconfig &&
        (updateKubeconfig === config.UpdateKubeconfig.Always ||
            updateKubeconfig === config.UpdateKubeconfig.OnCreate)
    ) {
        // args.push("--update-default-kubeconfig");  // pre 4.0
        args.push("--kubeconfig-update-default");
    }

    if (!switchContext) {
        // args.push("--switch-context=false"); // pre 4.0
        args.push("--kubeconfig-switch-context=false");
    }

    if (settings.growServers) {
        args.push("--k3s-server-arg", "--cluster-init");
    }

    return args;
}

//////////////////////////////////////////////////////////////////////////////////////////////
// default settings
//////////////////////////////////////////////////////////////////////////////////////////////

/**
 * An implementation of {@link ClusterSettings} that stores settings
 * using the VS Code memento API.
 */
class MementoClusterSettings implements ClusterCreateSettings {
    private readonly nameStorageKey = "k3d-last-name";
    private readonly imageStorageKey = "k3d-last-image";
    private readonly numServersStorageKey = "k3d-last-num-servers";
    private readonly numAgentsStorageKey = "k3d-last-num-agents";
    private readonly netStorageKey = "k3d-last-net";
    private readonly lbStorageKey = "k3d-last-lb";
    private readonly serverArgsKey = "k3d-last-server-args";
    private readonly createRegistryKey = "k3d-last-create-registry";
    private readonly useRegistriesKey = "k3d-last-use-registries";
    private readonly growServersStorageKey = "k3d-last-grow-servers";

    private readonly storage: vscode.Memento;

    public constructor(storage: vscode.Memento) {
        this.storage = storage;
    }

    set name(value: string | undefined) {
        this.storage.update(this.nameStorageKey, value);
    }
    get name(): string | undefined {
        return this.storage.get<string>(this.nameStorageKey);
    }

    set image(value: string | undefined) {
        this.storage.update(this.imageStorageKey, value);
    }
    get image(): string | undefined {
        return this.storage.get<string>(this.imageStorageKey);
    }

    set numServers(value: number | undefined) {
        this.storage.update(this.numServersStorageKey, value);
    }
    get numServers(): number | undefined {
        return this.storage.get<number>(this.numServersStorageKey);
    }

    set numAgents(value: number | undefined) {
        this.storage.update(this.numAgentsStorageKey, value);
    }
    get numAgents(): number | undefined {
        return this.storage.get<number>(this.numAgentsStorageKey);
    }

    set network(value: string | undefined) {
        this.storage.update(this.netStorageKey, value);
    }
    get network(): string | undefined {
        return this.storage.get<string>(this.netStorageKey);
    }

    set lb(value: boolean | undefined) {
        this.storage.update(this.lbStorageKey, value);
    }
    get lb(): boolean | undefined {
        return this.storage.get<boolean>(this.lbStorageKey);
    }

    set serverArgs(value: string | undefined) {
        this.storage.update(this.serverArgsKey, value);
    }
    get serverArgs(): string | undefined {
        return this.storage.get<string>(this.serverArgsKey);
    }

    set createRegistry(value: boolean | undefined) {
        this.storage.update(this.createRegistryKey, value);
    }
    get createRegistry(): boolean | undefined {
        return this.storage.get<boolean>(this.createRegistryKey);
    }

    set useRegistries(value: string[] | undefined) {
        this.storage.update(this.useRegistriesKey, value);
    }
    get useRegistries(): string[] | undefined {
        return this.storage.get<string[]>(this.useRegistriesKey);
    }

    set growServers(value: boolean | undefined) {
        this.storage.update(this.growServersStorageKey, value);
    }
    get growServers(): boolean | undefined {
        return this.storage.get<boolean>(this.growServersStorageKey);
    }

    private static instance: MementoClusterSettings;

    static getInstance(): MementoClusterSettings {
        if (!MementoClusterSettings.instance) {
            MementoClusterSettings.instance = new MementoClusterSettings(
                Context.current.workspaceState
            );
        }

        return MementoClusterSettings.instance;
    }
}

// getLastClusterSettings returns the last settings used
export const getLastClusterSettings = (): ClusterCreateSettings =>
    MementoClusterSettings.getInstance();

// save the last settings used for creating a cluster
export function saveLastClusterCreateSettings(saved: ClusterCreateSettings) {
    const lcs = getLastClusterSettings();
    lcs.name = saved.name;
    lcs.image = saved.image;
    lcs.network = saved.network;
    lcs.numServers = saved.numServers;
    lcs.numAgents = saved.numAgents;
    lcs.lb = saved.lb;
    lcs.serverArgs = saved.serverArgs;
    lcs.createRegistry = saved.createRegistry;
    lcs.useRegistries = saved.useRegistries;
    lcs.growServers = saved.growServers;
}

//////////////////////////////////////////////////////////////////////////////////////////////
// last settings
//////////////////////////////////////////////////////////////////////////////////////////////

/**
 * An implementation of {@link ClusterSettings} that gets settings
 * from the default values in the config.
 */
class DefaultClusterSettings implements ClusterCreateSettings {
    set name(value: string | undefined) {}
    get name(): string | undefined {
        return undefined;
    }

    set image(value: string | undefined) {}
    get image(): string | undefined {
        return config.getK3DConfigCreateDefaults<string>("image");
    }

    set numServers(value: number | undefined) {}
    get numServers(): number | undefined {
        return config.getK3DConfigCreateDefaults<number>("numServers");
    }

    set numAgents(value: number | undefined) {}
    get numAgents(): number | undefined {
        return config.getK3DConfigCreateDefaults<number>("numAgents");
    }

    set network(value: string | undefined) {}
    get network(): string | undefined {
        return config.getK3DConfigCreateDefaults<string>("network");
    }

    set lb(value: boolean | undefined) {}
    get lb(): boolean | undefined {
        return undefined;
    }

    set serverArgs(value: string | undefined) {}
    get serverArgs(): string | undefined {
        return config.getK3DConfigCreateDefaults<string>("serverArgs");
    }

    set createRegistry(value: boolean | undefined) {}
    get createRegistry(): boolean | undefined {
        return config.getK3DConfigCreateDefaults<boolean>("createRegistry");
    }

    set useRegistries(value: string[] | undefined) {}
    get useRegistries(): string[] | undefined {
        return config.getK3DConfigCreateDefaults<string[]>("useRegistries");
    }

    set growServers(value: boolean | undefined) {}
    get growServers(): boolean | undefined {
        return config.getK3DConfigCreateDefaults<boolean>("growServers");
    }

    private static instance: DefaultClusterSettings;

    static getInstance(): DefaultClusterSettings {
        if (!DefaultClusterSettings.instance) {
            DefaultClusterSettings.instance = new DefaultClusterSettings();
        }
        return DefaultClusterSettings.instance;
    }
}

// getDefaultClusterSettings returns the default settings used
export const getDefaultClusterSettings = (): ClusterCreateSettings =>
    DefaultClusterSettings.getInstance();

//////////////////////////////////////////////////////////////////////////////////////////////
// new clusters
//////////////////////////////////////////////////////////////////////////////////////////////

// forNewCluster() takes some settings and fixes values and sets some values for a new cluster
export function forNewCluster(
    input: ClusterCreateSettings
): ClusterCreateSettings {
    // the name is always reset for a new cluster
    const max = 1000;
    const randInt = Math.floor(Math.random() * (max + 1));
    const randomName = `k3d-cluster-${randInt}`;

    return {
        name: randomName,
        image: input.image === undefined ? "" : input.image,
        numServers: input.numServers === undefined ? 1 : input.numServers,
        growServers:
            input.growServers === undefined ? false : input.growServers,
        numAgents: input.numAgents === undefined ? 0 : input.numAgents,
        network: input.network === undefined ? "" : input.network,
        lb: input.lb === undefined ? true : input.lb,
        serverArgs: input.serverArgs === undefined ? "" : input.serverArgs,
        createRegistry:
            input.createRegistry === undefined ? false : input.createRegistry,
        useRegistries:
            input.useRegistries === undefined ? [] : input.useRegistries,
    };
}
