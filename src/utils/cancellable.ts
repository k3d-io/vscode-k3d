interface Accepted<T> {
    readonly cancelled: false;
    readonly value: T;
}

interface Cancelled {
    readonly cancelled: true;
}

export type Cancellable<T> = Accepted<T> | Cancelled;
