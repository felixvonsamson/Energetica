// The set of app routes a notification may link to.
//
// This file must not import anything — see notification-routes-register.d.ts for why.
// The registry starts empty and is filled in by declaration merging.
//
// Empty is the point: a program that does not include the register file leaves it that way, and
// AppRoute falls back to `string`. It is never used as a value type, so the rule's concern (an
// empty interface accepting `0` or `""`) does not apply.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface AppRouteRegistry {}

export type AppRoute = AppRouteRegistry extends {
    route: infer R extends string;
}
    ? R
    : string;
