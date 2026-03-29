// Exclude strings starting with a prefix
export type ExcludePrefix<
    T,
    Prefix extends string,
> = T extends `${Prefix}${string}` ? never : T;

// Include only strings starting with a prefix
export type IncludePrefix<
    T,
    Prefix extends string,
> = T extends `${Prefix}${string}` ? T : never;
