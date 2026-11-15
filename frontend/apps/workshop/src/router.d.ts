// https://tanstack.com/router/latest/docs/framework/react/guide/static-route-data

declare module "@tanstack/react-router" {
    interface StaticDataRouteOption {
        /** The page's title, shown in the browser tab. */
        title: string;
        /**
         * Gives the page a wider content column than the usual 1400px, for a
         * page with a lot of columns, such as the balance sheet (#1008). Read
         * by the Workshop's page shell.
         */
        wide?: boolean;
    }
}
export {};
