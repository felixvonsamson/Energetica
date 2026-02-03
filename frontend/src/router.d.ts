// https://tanstack.com/router/latest/docs/framework/react/guide/static-route-data

import { Capabilities } from "@/types/players";

type RouteConfig =
    | {
          // Public routes
          requiredRole: null;
      }
    | {
          // Routes that require a user with a "player" role
          requiredRole: "player";
          requiresSettledTile: boolean;
          isUnlocked: (capabilities: Capabilities) => boolean;
      };

declare module "@tanstack/react-router" {
    interface StaticDataRouteOption {
        title: string;
        routeConfig?: RouteConfig;
        infoDialog?: {
            title?: string; // If empty, the dialog title is inferred from route title
            contents: React.ReactNode;
        };
    }
}
export {};
