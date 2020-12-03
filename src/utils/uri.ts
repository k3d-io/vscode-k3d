import { Uri } from "vscode";

export function safeFilePath(uri: Uri): string | undefined {
    if (uri.scheme === "file") {
        return uri.fsPath;
    }
    return undefined;
}
