from . import heap
import time

def state_update(engine):
  engine.log("update all productions")

def check_heap(engine):
  engine.log("checking heap")
  if heap[0][0] < time.time():
    _, function, args = heapq.heappop(heap)
