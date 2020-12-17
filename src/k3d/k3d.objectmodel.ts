export interface K3dClusterNodeInfo {
    readonly name: string;
    readonly network: string;
    readonly role: string;
    readonly running: boolean;
    readonly image: string;
}

export interface K3dClusterInfo {
    readonly name: string;
    readonly nodes: K3dClusterNodeInfo[];
    readonly agentsCount: number;
    readonly agentsRunning: number;
    readonly serversCount: number;
    readonly serversRunning: number;
    readonly hasLoadBalancer: boolean;
    readonly imageVolume: string;

}
