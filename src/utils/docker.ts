import "process";

import { Docker, Options } from 'docker-cli-js';

// getDockerInfo returns the same info obtained with `docker info`
export async function getDockerInfo(dockerHost?: string): Promise<any> {
    const options = new Options();

    if (dockerHost) {
        let localEnv = process.env;
        localEnv["DOCKER_HOST"] = dockerHost;
        options.env = localEnv;
    }

    let docker = new Docker(options);
    return docker.command('info').then(function (data) {
        return data.object;
    });
}