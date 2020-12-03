export interface Succeeded<T> {
    readonly succeeded: true;
    readonly result: T;
}

export interface Failed {
    readonly succeeded: false;
    readonly error: string[];
}

export type Errorable<T> = Succeeded<T> | Failed;

export function succeeded<T>(e: Errorable<T>): e is Succeeded<T> {
    return e.succeeded;
}

export function failed<T>(e: Errorable<T>): e is Failed {
    return !e.succeeded;
}

export function map<T, U>(e: Errorable<T>, fn: (t: T) => U): Errorable<U> {
    if (failed(e)) {
        return { succeeded: false, error: e.error };
    }
    return { succeeded: true, result: fn(e.result) };
}
