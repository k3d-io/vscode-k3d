import replaceString from "replace-string";

declare global {
    interface String {
        replaceAll(search: string, replacement: string): string;
    }
}

if (!String.prototype.replaceAll) {
    String.prototype.replaceAll = function (
        this: string,
        search: string,
        replacement: string
    ) {
        return replaceString(this, search, replacement);
    };
}
