from fastapi import APIRouter

router = APIRouter(prefix="/map", tags=["map"])


@router.get("/get")
def get_map() -> dict:
    """Get the map data from the database and returns it as a array of dictionaries."""
    return {"test": "test"}
