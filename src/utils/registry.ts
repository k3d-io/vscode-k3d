import { workspace } from "vscode";
import { Response } from "request";
import * as request from 'request-promise-native';
import { URL } from "url";

import { Errorable } from '../utils/errorable';

// maximum number of tags to return
const MAX_TAGS_RESULTS = 12;

interface IResponse<T> extends Response {
    body: T;
}

export async function registryRequest<T>(method: 'GET' | 'DELETE' | 'POST', url: string, customOptions?: request.RequestPromiseOptions): Promise<IResponse<T>> {
    let httpSettings = workspace.getConfiguration('http');
    let strictSSL = httpSettings.get<boolean>('proxyStrictSSL', true);
    const options = {
        method,
        json: true,
        resolveWithFullResponse: true,
        strictSSL: strictSSL,
        ...customOptions
    }
    return <IResponse<T>>await request(url, options);
}

interface ITags {
    next?: string;
    results: ITag[];
}

export interface ITagImage {
    architecture: string;
}

export interface ITag {
    name: string;
    /* eslint-disable-next-line camelcase */
    tag_status: string;
    /* eslint-disable-next-line camelcase */
    last_updated: string;

    images: ITagImage[];
}

// Compare two tags, using the `last_updated` field
function ITagCompare(a: ITag, b: ITag): number {
    return new Date(a.last_updated).getTime() - new Date(b.last_updated).getTime();
}

// registryTagsForImage queries a registry about all the tags for some image, filering by some
// optional criteria (ie, regex, architecture, etc)
export async function registryTagsForImage(registry: string, namespace: string, repoName: string,
    regex?: RegExp, arch?: string, limit: number = MAX_TAGS_RESULTS): Promise<Errorable<ITag[]>> {

    let res: ITag[] = [];
    const urlInit = new URL(`${registry}/v2/repositories/${namespace}/${repoName}/tags`);
    let url: string = urlInit.toString();
    while (true) {
        let response = await registryRequest<ITags>('GET', url.toString());
        // TODO: we should check the response errors

        res = res.concat(response.body.results
            .filter((i: ITag) => i.tag_status === "active")
            .filter((image) => regex ? regex.test(image.name) : true)
            .filter((image) => arch ? image.images.some((x) => x.architecture === getVariantForArch(arch)) : true)
        );

        if (response.body.next && response.body.next !== url && res.length < limit) {
            url = response.body.next;
        } else {
            return {
                succeeded: true,
                result: res.sort(ITagCompare).slice(0, limit)
            };
        }
    }
}

// getVariantForArch returns the image variant for an architecture
function getVariantForArch(arch: string): string {
    switch (arch) {
        case "x86_64":
            return "amd64";

        case "arm64":
            return "arm64";

        default:
            return "amd64";
    }
}
