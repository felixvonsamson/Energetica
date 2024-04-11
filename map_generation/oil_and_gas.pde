ArrayList<Grow_tile_oil> growing_patches_oil = new ArrayList<Grow_tile_oil>();

void generate_oil_gas(){
  int oilpatches = 0;
  while(oilpatches<0.15*mapsize){
    int rand_id = 0;
    Hex seedTile = null;
    while(seedTile == null){
      rand_id = floor(random(mapsize));
      seedTile = map[rand_id];
    }
    Grow_tile_oil seed_tile = new Grow_tile_oil(rand_id);
    growing_patches_oil.add(seed_tile);
    while(growing_patches_oil.size() > 0 & oilpatches<0.20*mapsize){
      int i_max = growing_patches_oil.size();
      for(int i = 0; i<i_max; i++){
        Grow_tile_oil tile = growing_patches_oil.get(i);
        tile.add_oil();
        oilpatches++;
      }
      for(int i = 0; i<i_max; i++){
        Grow_tile_oil tile = growing_patches_oil.get(0);
        tile.create_children();
        growing_patches_oil.remove(0);
      }
    }
  }
  for(int i = 0; i<map.length; i++){
    Hex h = map[i];
    int count = 0;
    PVector position = new PVector(h.q, h.r);
    for(int k = 0; k<directions.length; k++){
      PVector new_position = position.copy().add(directions[k]);
      int new_id = coords_to_id(int(new_position.x), int(new_position.y));
      if(new_id >= map.length){
        continue;
      }
      Hex neighbour = map[new_id];
      if(neighbour.resources[4]!=0){
        count++;
      }
    }
    if(count >0){
      float a = count*(1-0.2*count*h.resources[4]);
      if(a>2 | random(2)<1 | h.resources[4]!=0){
        h.resources[5] = max(0,min(1,random(a/10, a/3)));
      }
    }
    if(h.resources[4]==1){
      h.resources[4] = min(1,random(count*0.1, sqrt(count)*0.6));
    }
  }
}

class Grow_tile_oil{
  int id;
  PVector position;
  Grow_tile_oil(int _id){
    id = _id;
    PVector cords = id_to_coords(_id);
    position = new PVector(int(cords.x), (cords.y));
  }
  void add_oil(){
    Hex h = map[id];
    float value = 1;
    h.resources[4] = value;
  }
  void create_children(){
    for(int i = 0; i<directions.length; i++){
      PVector new_positon = position.copy().add(directions[i]);
      int new_id = coords_to_id(int(new_positon.x), int(new_positon.y));
      Grow_tile_oil new_tile = new Grow_tile_oil(new_id);
      if(new_tile.inBounds()){
        if(new_tile.isEligible()){
          growing_patches_oil.add(new_tile);
        }
      }
    }
  }
  boolean inBounds(){
    if(id >= mapsize){
      return false;
    }
    Hex h = map[id];
    if(h.resources[4] != 0){
      return false;
    }
    for(int i = 0; i<growing_patches_oil.size(); i++){
      if(growing_patches_oil.get(i).id == id){
        return false;
      }
    }
    return true;
  }
  boolean isEligible(){
    int count = 0;
    for(int i = 0; i<directions.length; i++){
      PVector new_positon = position.copy().add(directions[i]);
      int new_id = coords_to_id(int(new_positon.x), int(new_positon.y));
      if(new_id >= mapsize){
        continue;
      }
      Hex h = map[new_id];
      if(h.resources[4]!=0){
        count++;
      }
    }
    float[] r = map[id].resources;
    float a = r[0]+r[2]+r[3];
    if(count == 2 & random(20*a)<1){
      return true;
    }
    if(count == 1 & random(5*a)<1){
      return true;
    }
    return false;
  } 
}
