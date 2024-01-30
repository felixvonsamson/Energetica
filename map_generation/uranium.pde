void generate_uranium(){
  int uranium_tile = 0;
  while(uranium_tile<0.05*sq(mapsize)){
    int randx = 0;
    int randy = 0;
    Hex seedTile = null;
    while(seedTile == null){
      randx = floor(random(mapsize));
      randy = floor(random(mapsize));
      seedTile = map[randx][randy];
    }
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
      randx += dir.x;
      randy += dir.y;
      if(randx<0 | randy<0 | randx>=mapsize | randy>=mapsize){
        break;
      }
      Hex new_tile = map[randx][randy];
      if(new_tile == null){
        break;
      }
      if(new_tile.resources[6] != 0){
        continue;
      }
      r = new_tile.resources;
      if(r[0]+r[2]+r[3]+r[4]+r[5]>1.7){
        continue;
      }
      new_tile.resources[6] = max(0,min(1,random(min_value,1.1)));
      uranium_tile++;
    }
  }
}
