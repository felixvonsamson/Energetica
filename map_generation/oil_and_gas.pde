ArrayList<Grow_tile_oil> growing_patches_oil = new ArrayList<Grow_tile_oil>();

void generate_oil_gas(){
  int oilpatches = 0;
  while(oilpatches<0.15*sq(mapsize)){
    int randx = 0;
    int randy = 0;
    Hex seedTile = null;
    while(seedTile == null){
      randx = floor(random(mapsize));
      randy = floor(random(mapsize));
      seedTile = map[randx][randy];
    }
    Grow_tile_oil seed_tile = new Grow_tile_oil(new PVector(randx, randy));
    growing_patches_oil.add(seed_tile);
    while(growing_patches_oil.size() > 0 & oilpatches<0.20*sq(mapsize)){
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
  for(int i = 0; i<mapsize; i++){
    for(int j = 0; j<mapsize; j++){
      Hex h = map[i][j];
      if(h == null){
        continue;
      }
      int count = 0;
      PVector position = new PVector(i, j);
      for(int k = 0; k<directions.length; k++){
        PVector new_positon = position.copy().add(directions[k]);
        if(new_positon.x<0 | new_positon.y<0 | new_positon.x>=mapsize | new_positon.y>=mapsize){
          continue;
        }
        Hex neighbour = map[round(new_positon.x)][round(new_positon.y)];
        if(neighbour == null){
          continue;
        }
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
}

class Grow_tile_oil{
  PVector position;
  Grow_tile_oil(PVector _position){
    position = _position;
  }
  void add_oil(){
    Hex h = map[round(position.x)][round(position.y)];
    float value = 1;
    h.resources[4] = value;
  }
  void create_children(){
    for(int i = 0; i<directions.length; i++){
      PVector new_positon = position.copy().add(directions[i]);
      Grow_tile_oil new_tile = new Grow_tile_oil(new_positon);
      if(new_tile.inBounds()){
        if(new_tile.isEligible()){
          growing_patches_oil.add(new_tile);
        }
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
    if(h.resources[4] != 0){
      return false;
    }
    for(int i = 0; i<growing_patches_oil.size(); i++){
      if(growing_patches_oil.get(i).position.copy().sub(position).mag()<0.5){
        return false;
      }
    }
    return true;
  }
  boolean isEligible(){
    int count = 0;
    for(int i = 0; i<directions.length; i++){
      PVector new_positon = position.copy().add(directions[i]);
      if(new_positon.x<0 | new_positon.y<0 | new_positon.x>=mapsize | new_positon.y>=mapsize){
        continue;
      }
      Hex h = map[round(new_positon.x)][round(new_positon.y)];
      if(h == null){
        continue;
      }
      if(h.resources[4]!=0){
        count++;
      }
    }
    float[] r = map[round(position.x)][round(position.y)].resources;
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
