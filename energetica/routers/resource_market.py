"""Routes for the resource market."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from energetica.auth import get_current_user
from energetica.database.player import Player
from energetica.database.resource_on_sale import ResourceOnSale
from energetica.schemas.resource_market import AskCreate, AskListOut, AskOut, PurchaseOrderCreate
from energetica.utils.resource_market import create_ask, purchase_resource

router = APIRouter(prefix="/resource_market", tags=["Resource Market"])


@router.get("/asks")
def get_resource_market_asks() -> AskListOut:
    """Get the resource market."""
    return AskListOut(
        asks=[AskOut.from_resource_on_sale(ask) for ask in ResourceOnSale.all()],
    )


@router.post("/asks", status_code=201)
def post_resource_market_ask(
    player: Annotated[Player, Depends(get_current_user)],
    request_data: AskCreate,
) -> AskOut:
    """Post a resource market bid."""
    return AskOut.from_resource_on_sale(
        create_ask(
            player=player,
            fuel=request_data.resource_type,
            quantity=request_data.quantity,
            unit_price=request_data.unit_price,
        ),
    )


@router.post("/asks/{ask_id}:purchase")
def post_resource_market_purchase(
    player: Annotated[Player, Depends(get_current_user)],
    ask_id: int,
    request_data: PurchaseOrderCreate,
) -> AskOut | None:
    """Purchase a resource market ask."""
    sale = ResourceOnSale.getitem(ask_id, error=HTTPException(status_code=404, detail="Ask not found"))
    # TODO(mglst): Add the following check in the future
    # if sale.player == user:
    #     raise HTTPException(status_code=403, detail="You cannot buy your own ask")
    new_sale = purchase_resource(
        player=player,
        quantity=request_data.quantity,
        sale=sale,
    )
    if new_sale is None:
        return None
    return AskOut.from_resource_on_sale(new_sale)


@router.patch("/asks/{ask_id}")
def patch_resource_market_ask(
    player: Annotated[Player, Depends(get_current_user)],
    ask_id: int,
    request_data: AskCreate,  # TODO: remove resource_type from schema for this route
) -> AskOut:
    """Patch a resource market ask."""
    sale = ResourceOnSale.getitem(ask_id, error=HTTPException(status_code=404, detail="Ask not found"))
    if sale.player != player:
        raise HTTPException(status_code=403, detail="You are not the owner of this ask")
    if request_data.unit_price is not None:
        sale.unit_price = request_data.unit_price
    if request_data.quantity is not None:
        sale.quantity = request_data.quantity
    return AskOut.from_resource_on_sale(sale)


@router.delete("/asks/{ask_id}", status_code=204)
def delete_resource_market_ask(
    player: Annotated[Player, Depends(get_current_user)],
    ask_id: int,
) -> None:
    """Delete a resource market ask."""
    sale = ResourceOnSale.getitem(ask_id, error=HTTPException(status_code=404, detail="Ask not found"))
    if sale.player != player:
        raise HTTPException(status_code=403, detail="You are not the owner of this ask")
    sale.delete()
