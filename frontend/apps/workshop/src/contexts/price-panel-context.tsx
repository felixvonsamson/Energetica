/**
 * Lets any Workshop page open the price-setting panel (#1002), whose open state
 * lives in the Workshop page shell. The Prices board uses it to send players
 * who click their own row to the panel (#1388).
 */

import { createContext, useContext } from "react";

const PricePanelContext = createContext<(() => void) | undefined>(undefined);

export const PricePanelProvider = PricePanelContext.Provider;

/** Opens the price panel. */
export function useOpenPricePanel() {
    const open = useContext(PricePanelContext);
    if (!open) {
        throw new Error(
            "useOpenPricePanel must be used within PricePanelProvider",
        );
    }
    return open;
}
