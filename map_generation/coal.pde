ArrayList<Grow_tile_coal> growing_patches_coal = new ArrayList<Grow_tile_coal>();

void generate_coal(){
  int coal_tile = 0;
  while(coal_tile<0.3*mapsize){
    int rand_id = 0;
    Hex seedTile = null;
    while(seedTile == null){
      rand_id = floor(random(mapsize));
      seedTile = map[rand_id];
    }
    coal_tile++;
    Grow_tile_coal seed_tile = new Grow_tile_coal(rand_id, 1.5);
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
  int id;
  float max_value;
  Grow_tile_coal(int _id, float _max_value){
    id = _id;
    max_value = _max_value;
  }
  void add_coal(){
    Hex h = map[id];
    float value = max(0,min(1,random(max_value-0.4,max_value*0.9)));
    h.resources[3] = value;
  }
  void create_children(){
    Hex h = map[id];
    PVector position = new PVector(h.q, h.r);
    for(int i = 0; i<directions.length; i++){
      PVector new_positon = position.copy().add(directions[i]);
      int new_id = coords_to_id(int(new_positon.x), int(new_positon.y));
      Grow_tile_coal new_tile = new Grow_tile_coal(new_id, max_value-0.2);
      if(new_tile.inBounds()){
        growing_patches_coal.add(new_tile);
      }
    }
  }
  boolean inBounds(){
    if(max_value<=0){
      return false;
    }
    if(id >= mapsize){
      return false;
    }
    Hex h = map[id];
    if(h.resources[3] != 0 & h.resources[3] > this.max_value-0.2){
      return false;
    }
    for(int i = 0; i<growing_patches_coal.size(); i++){
      if(growing_patches_coal.get(i).id == id){
        return false;
      }
    }
    return true;
  }
}
