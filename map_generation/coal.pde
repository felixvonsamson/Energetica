ArrayList<Grow_tile_coal> growing_patches_coal = new ArrayList<Grow_tile_coal>();

void generate_coal(){
  int coal_tile = 0;
  while(coal_tile<0.3*sq(mapsize)){
    int randx = 0;
    int randy = 0;
    Hex seedTile = null;
    while(seedTile == null){
      randx = floor(random(mapsize));
      randy = floor(random(mapsize));
      seedTile = map[randx][randy];
    }
    coal_tile++;
    Grow_tile_coal seed_tile = new Grow_tile_coal(new PVector(randx, randy), 1.5);
    growing_patches_coal.add(seed_tile);
    while(growing_patches_coal.size() > 0){
      int i_max = growing_patches_coal.size();
      for(int i = 0; i<i_max; i++){
        Grow_tile_coal tile = growing_patches_coal.get(i);
        tile.add_coal();
        coal_tile++;
      }
      for(int i = 0; i<i_max; i++){
        Grow_tile_coal tile = growing_patches_coal.get(0);
        tile.create_children();
        growing_patches_coal.remove(0);
      }
    }
  }
}

class Grow_tile_coal{
  PVector position;
  float max_value;
  Grow_tile_coal(PVector _position, float _max_value){
    position = _position;
    max_value = _max_value;
  }
  void add_coal(){
    Hex h = map[round(position.x)][round(position.y)];
    float value = max(0,min(1,random(max_value-0.4,max_value*0.9)));
    h.resources[3] = value;
  }
  void create_children(){
    for(int i = 0; i<directions.length; i++){
      PVector new_positon = position.copy().add(directions[i]);
      Grow_tile_coal new_tile = new Grow_tile_coal(new_positon, max_value-0.2);
      if(new_tile.inBounds()){
        growing_patches_coal.add(new_tile);
      }
    }
  }
  boolean inBounds(){
    if(max_value<=0){
      return false;
    }
    if(position.x<0 | position.y<0 | position.x>=mapsize | position.y>=mapsize){
      return false;
    }
    Hex h = map[round(position.x)][round(position.y)];
    if(h == null){
      return false;
    }
    if(h.resources[3] != 0){
      return false;
    }
    for(int i = 0; i<growing_patches_coal.size(); i++){
      if(growing_patches_coal.get(i).position.copy().sub(position).mag()<0.5){
        return false;
      }
    }
    return true;
  }
}
