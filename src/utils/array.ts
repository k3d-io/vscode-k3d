export function flatten<T>(...arrays: T[][]): T[] {
    return Array.of<T>().concat(...arrays);
}

export function definedOf<T>(...items: (T | undefined)[]): T[] {
    return items.filter((i) => i !== undefined).map((i) => i!);
}

declare global {
    interface Array<T> {
        choose<U>(fn: (t: T) => U | undefined): U[];
        orderBy<U>(key: (t: T) => U): T[];
    }
}

if (!Array.prototype.choose) {
    Array.prototype.choose = function<T, U>(this: T[], fn: (t: T) => U | undefined): U[] {
        return this.map(fn).filter((u) => u !== undefined).map((u) => u!);
    };
}

if (!Array.prototype.orderBy) {
    Array.prototype.orderBy = function<T, U>(this: T[], key: (fn: T) => U): T[] {
        const copy = this.map((e) => ({ index: key(e), value: e }));
        copy.sort((m1, m2) => (m1.index > m2.index) ? 1 : (m1.index < m2.index ? -1 : 0));
        return copy.map((m) => m.value);
    };
}
