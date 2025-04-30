from .chats import router as chat_router
from .daily_quiz import router as daily_quiz_router
from .map import router as map_router
from .network import router as network_router
from .players import router as player_router
from .resource_market import router as resource_market_router

all_routers = [chat_router, daily_quiz_router, map_router, network_router, player_router, resource_market_router]
