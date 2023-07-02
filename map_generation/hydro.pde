ArrayList<Flow_tile> current_flows = new ArrayList<Flow_tile>();

void generate_hydro(){
  int water_tile = 0;
  while(water_tile<0.1*sq(mapsize)){
    int randx = 0;
    int randy = 0;
    int neighbours = 0;
    Hex seedTile = null;
    while(seedTile == null | neighbours > 0){
      randx = floor(random(mapsize));
      randy = floor(random(mapsize));
      neighbours = neighbours(new PVector(randx, randy));
      seedTile = map[randx][randy];
    }
    seedTile.ressources[2] = 1;
    water_tile++;
    int rand_dir = floor(random(6));
    PVector dir1 = new PVector(randx + directions[rand_dir].x, randy + directions[rand_dir].y);
    PVector dir2 = new PVector(randx - directions[rand_dir].x, randy - directions[rand_dir].y);
    Flow_tile child1 = new Flow_tile(rand_dir, dir1, 0.98);
    Flow_tile child2 = new Flow_tile((rand_dir+3)%6, dir2, 0.98);
    if (child1.inBounds()){
      current_flows.add(child1);
    }
    if (child2.inBounds()){
      current_flows.add(child2);
    }
    while(current_flows.size() > 0 & water_tile<0.25*sq(mapsize)){
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
    Hex h = map[round(position.x)][round(position.y)];
    h.ressources[2] = age;
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
    if(position.x<0 | position.y<0 | position.x>=mapsize | position.y>=mapsize){
      return false;
    }
    Hex h = map[round(position.x)][round(position.y)];
    if(h == null){
      return false;
    }
    if(age <= 0){
      return false;
    }
    int neighbours = neighbours(position);
    if(neighbours > 1){
      return false;
    }
    return true;
  }
}

int neighbours(PVector position){
  int count = 0;
  for(int i = 0; i<directions.length; i++){
    PVector new_positon = position.copy().add(directions[i]);
    if(new_positon.x<0 | new_positon.y<0 | new_positon.x>=mapsize | new_positon.y>=mapsize){
      continue;
    }
    Hex neighbour = map[round(new_positon.x)][round(new_positon.y)];
    if(neighbour == null){
      continue;
    }
    if(neighbour.ressources[2]!=0){
      count++;
    }
  }
  return count;
}
