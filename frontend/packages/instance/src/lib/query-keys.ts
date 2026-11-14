/**
 * The query keys of this package's queries. The package owns them, so an app
 * must not reuse the `facilitator` or `join` roots for its own queries.
 */
export const instanceQueryKeys = {
    facilitator: {
        access: ["facilitator", "access"] as const,
        roster: ["facilitator", "roster"] as const,
        rosterCandidates: (prefix: string) =>
            ["facilitator", "roster", "candidates", prefix] as const,
    },
    join: {
        link: (token: string) => ["join", "link", token] as const,
    },
} as const;
