import { Link, type LinkProps } from "@tanstack/react-router";
import type { ComponentProps, ReactNode } from "react";

import { resolveContentLink } from "#content/content-links";
import { useContentHost } from "#content/host-context";

/**
 * A link written in the content: every markdown link, and the JSX links the
 * pages write as `<ContentLink>`. It goes wherever the app rendering the page
 * says; see `resolveContentLink`.
 */
export function ContentLink({ href, children, ...rest }: ComponentProps<"a">) {
    const host = useContentHost();
    const target =
        href === undefined
            ? ({ kind: "plain" } as const)
            : resolveContentLink(href, host);

    switch (target.kind) {
        case "route":
            // The paths come from the pages and the host, so the route tree
            // cannot check them.
            return (
                <Link to={target.to as LinkProps["to"]} hash={target.hash}>
                    {children}
                </Link>
            );
        case "unavailable":
            return <InertLink title="A page of the game">{children}</InertLink>;
        case "plain":
            return (
                <a href={href} {...rest}>
                    {children}
                </a>
            );
    }
}

/** The text of a link the reader cannot follow, styled to show why on hover. */
export function InertLink({
    title,
    children,
}: {
    title: string;
    children: ReactNode;
}) {
    return (
        <span
            className="cursor-not-allowed underline decoration-dashed text-muted-foreground"
            title={title}
        >
            {children}
        </span>
    );
}
