void generate_uranium(){
  int uranium_tile = 0;
  while(uranium_tile<0.05*mapsize){
    int rand_id = floor(random(mapsize));
    Hex seedTile = map[rand_id];
    float[] r = seedTile.resources;
    if(r[0]+r[2]+r[3]+r[4]+r[5]>1.7){
      continue;
    }
    float min_value = 0.8;
    seedTile.resources[6] = min(1,random(0.7,1.1));
    uranium_tile++;
    while(random(2)<1){
      min_value -= 0.2;
      PVector dir = directions[floor(random(6))];
      PVector new_position = new PVector(seedTile.q+dir.x, seedTile.r+dir.y);
      int new_id = coords_to_id(int(new_position.x), int(new_position.y));
      if(new_id >= map.length){
        break;
      }
      Hex new_tile = map[new_id];
      if(new_tile.resources[6] != 0){
        continue;
      }
      r = new_tile.resources;
      if(r[0]+r[2]+r[3]+r[4]+r[5]>1.7){
        continue;
      }
      new_tile.resources[6] = max(0,min(1,random(min_value,1.1)));
      seedTile = new_tile;
      uranium_tile++;
    }
  }
}
