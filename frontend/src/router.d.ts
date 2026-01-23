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
        infoModal?: {
            title?: string; // If empty, the modal title is inferred from route title
            contents: React.ReactNode;
        };
    }
}
export {};
