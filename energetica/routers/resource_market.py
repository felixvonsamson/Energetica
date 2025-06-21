"""Routes for the resource market."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from energetica.auth import get_current_user
from energetica.database.player import Player
from energetica.database.resource_on_sale import ResourceOnSale
from energetica.schemas.resource_market import AskCreate, AskList, AskOut, PurchaseOrderCreate
from energetica.utils.resource_market import buy_resource_from_market, put_resource_on_market

router = APIRouter(prefix="/resource_market", tags=["Resource Market"])


@router.get("/asks")
async def get_resource_market_asks() -> AskList:
    """Get the resource market."""
    return AskList(
        asks=[ask.to_schema() for ask in ResourceOnSale.all()],
    )


@router.post("/asks", status_code=201)
async def post_resource_market_ask(
    user: Annotated[Player, Depends(get_current_user)],
    request_data: AskCreate,
) -> AskOut:
    """Post a resource market bid."""
    return put_resource_on_market(
        player=user,
        fuel=request_data.resource_type,
        quantity=request_data.quantity,
        unit_price=request_data.unit_price,
    ).to_schema()


@router.post("/asks/{ask_id}/purchase")
async def post_resource_market_ask_purchase(
    user: Annotated[Player, Depends(get_current_user)],
    ask_id: int,
    request_data: PurchaseOrderCreate,
) -> AskOut | None:
    """Purchase a resource market ask."""
    sale = ResourceOnSale.getitem(ask_id, error=HTTPException(status_code=404, detail="Ask not found"))
    # TODO(mglst): Add the following check in the future
    # if sale.player == user:
    #     raise HTTPException(status_code=403, detail="You cannot buy your own ask")
    new_sale = buy_resource_from_market(
        player=user,
        quantity=request_data.quantity,
        sale=sale,
    )
    if new_sale is None:
        return None
    return new_sale.to_schema()


@router.patch("/asks/{ask_id}")
async def patch_resource_market_ask(
    user: Annotated[Player, Depends(get_current_user)],
    ask_id: int,
    request_data: AskCreate,
) -> AskOut:
    """Patch a resource market ask."""
    sale = ResourceOnSale.getitem(ask_id, error=HTTPException(status_code=404, detail="Ask not found"))
    if sale.player != user:
        raise HTTPException(status_code=403, detail="You are not the owner of this ask")
    if request_data.unit_price is not None:
        sale.unit_price = request_data.unit_price
    if request_data.quantity is not None:
        sale.quantity = request_data.quantity
    return sale.to_schema()


@router.delete("/asks/{ask_id}", status_code=204)
async def delete_resource_market_ask(
    user: Annotated[Player, Depends(get_current_user)],
    ask_id: int,
) -> None:
    """Delete a resource market ask."""
    sale = ResourceOnSale.getitem(ask_id, error=HTTPException(status_code=404, detail="Ask not found"))
    if sale.player != user:
        raise HTTPException(status_code=403, detail="You are not the owner of this ask")
    sale.delete()
