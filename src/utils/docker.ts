import "process";

import { Docker, Options } from "docker-cli-js";

// getDockerInfo returns the same info obtained with `docker info`
export async function getDockerInfo(dockerHost?: string): Promise<any> {
    const options = new Options();

    if (dockerHost) {
        const localEnv = process.env;
        localEnv["DOCKER_HOST"] = dockerHost;
        options.env = localEnv;
    }

    const docker = new Docker(options);
    return docker.command("info").then(function (data) {
        return data.object;
    });
}
