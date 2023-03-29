export function minDate(arr: Date[]) {
    return arr.reduce(function (p, v) {
        return p < v ? p : v;
    });
}
