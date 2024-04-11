ArrayList<Flow_tile> current_flows = new ArrayList<Flow_tile>();

void generate_hydro(){
  int water_tile = 0;
  while(water_tile<0.15*mapsize){
    int rand_id = 0;
    int neighbours = 0;
    Hex seedTile = null;
    while(seedTile == null | neighbours > 0){
      rand_id = floor(random(mapsize));
      seedTile = map[rand_id];
      neighbours = count_neighbours(new PVector(seedTile.q, seedTile.r));
    }
    seedTile.resources[2] = 1;
    water_tile++;
    int rand_dir = floor(random(6));
    PVector dir1 = new PVector(seedTile.q + directions[rand_dir].x, seedTile.r + directions[rand_dir].y);
    PVector dir2 = new PVector(seedTile.q - directions[rand_dir].x, seedTile.r - directions[rand_dir].y);
    Flow_tile child1 = new Flow_tile(rand_dir, dir1, 0.98);
    Flow_tile child2 = new Flow_tile((rand_dir+3)%6, dir2, 0.98);
    if (child1.inBounds()){
      current_flows.add(child1);
    }
    if (child2.inBounds()){
      current_flows.add(child2);
    }
    while(current_flows.size() > 0 & water_tile<0.25*mapsize){
      int i_max = current_flows.size();
      for(int i = 0; i<i_max; i++){
        Flow_tile flow = current_flows.get(0);
        flow.flow();
        water_tile++;
        current_flows.remove(0);
      }
    }
  }
}

class Flow_tile{
  PVector position;
  int dir;
  float age;
  Flow_tile(int _dir, PVector _position, float _age){
    dir = _dir;
    position = _position;
    age = _age;
  }
  void flow(){
    int deviation = floor(random(3))-1;
    int new_dir = (dir + deviation + 6)%6;
    Hex h = map[coords_to_id(int(position.x), int(position.y))];
    h.resources[2] = age;
    Flow_tile child_flow = new Flow_tile(new_dir, position.copy().add(directions[new_dir]), age-0.02);
    if (child_flow.inBounds()){
      current_flows.add(child_flow);
    }
    if(deviation != 0 & random(4)<1){
      new_dir = (dir - deviation + 6)%6;
      child_flow = new Flow_tile(new_dir, position.copy().add(directions[new_dir]), age-0.06);
      if (child_flow.inBounds()){
        current_flows.add(child_flow);
      }
    }
  }
  boolean inBounds(){
    if(coords_to_id(int(position.x), int(position.y)) >= map.length){
      return false;
    }
    if(age <= 0){
      return false;
    }
    int neighbours = count_neighbours(position);
    if(neighbours > 1){
      return false;
    }
    return true;
  }
}

int count_neighbours(PVector position){
  int count = 0;
  for(int i = 0; i<directions.length; i++){
    PVector new_positon = position.copy().add(directions[i]);
    int neighbour_id = coords_to_id(int(new_positon.x), int(new_positon.y));
    if(neighbour_id >= map.length){
      continue;
    }
    Hex neighbour = map[neighbour_id];
    if(neighbour.resources[2]!=0){
      count++;
    }
  }
  return count;
}
