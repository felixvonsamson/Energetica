import type {
    LockedLinkProps,
    WikiComponents,
} from "@energetica/content/wiki-pages";

/**
 * A visitor to the landing page is not playing, so has unlocked nothing. Every
 * locked link shows as locked.
 */
function LockedLink({ children }: LockedLinkProps) {
    return (
        <span
            className="cursor-not-allowed underline decoration-dashed text-muted-foreground"
            title="Not unlocked"
        >
            {children}
        </span>
    );
}

/** The components the landing page supplies to the wiki pages. */
export const wikiComponents: WikiComponents = { LockedLink };
