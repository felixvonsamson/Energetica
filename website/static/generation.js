function count_neighbours(position){
    let count = 0;
    for(let i = 0; i<directions.length; i++){
      let new_positon = position.copy().add(directions[i]);
      if(new_positon.x<0 | new_positon.y<0 | new_positon.x>=mapsize | new_positon.y>=mapsize){
        continue;
      }
      let neighbour = map[round(new_positon.x)][round(new_positon.y)];
      if(neighbour == null){
        continue;
      }
      if(neighbour.ressources[2]!=0){
        count++;
      }
    }
    return count;
  }
  
  class Flow_tile{
    constructor(_dir, _position, _age){
      this.dir = _dir;
      this.position = _position;
      this.age = _age;
    }
    flow(){
      let deviation = floor(random(3))-1;
      let new_dir = (this.dir + deviation + 6)%6;
      let h = map[round(this.position.x)][round(this.position.y)];
      h.ressources[2] = this.age;
      let child_flow = new Flow_tile(new_dir, this.position.copy().add(directions[new_dir]), this.age-0.02);
      if (child_flow.inBounds()){
        append(current_flows, child_flow);
      }
      if(deviation != 0 & random(4)<1){
        new_dir = (this.dir - deviation + 6)%6;
        child_flow = new Flow_tile(new_dir, this.position.copy().add(directions[new_dir]), this.age-0.06);
        if (child_flow.inBounds()){
          append(current_flows, child_flow);
        }
      }
    }
    inBounds(){
      if(this.position.x<0 | this.position.y<0 | this.position.x>=mapsize | this.position.y>=mapsize){
        return false;
      }
      let h = map[round(this.position.x)][round(this.position.y)];
      if(h == null){
        return false;
      }
      if(this.age <= 0){
        return false;
      }
      let neighbours = count_neighbours(this.position);
      if(neighbours > 1){
        return false;
      }
      return true;
    }
  }
  
  let current_flows = [];
  
  function generate_hydro(){
    let water_tile = 0;
    while(water_tile<0.1*sq(mapsize)){
      let randx = 0;
      let randy = 0;
      let neighbours = 0;
      let seedTile = null;
      while(seedTile == null | neighbours>0){
        randx = floor(random(mapsize));
        randy = floor(random(mapsize));
        neighbours = count_neighbours(createVector(randx, randy));
        seedTile = map[randx][randy];
      }
      seedTile.ressources[2] = 1;
      water_tile++;
      let rand_dir = floor(random(6));
      let dir1 = createVector(randx + directions[rand_dir].x, randy + directions[rand_dir].y);
      let dir2 = createVector(randx - directions[rand_dir].x, randy - directions[rand_dir].y);
      let child1 = new Flow_tile(rand_dir, dir1, 0.98);
      let child2 = new Flow_tile((rand_dir+3)%6, dir2, 0.98);
      if (child1.inBounds()){
        append(current_flows, child1);
      }
      if (child2.inBounds()){
        append(current_flows, child2);
      }
      while(current_flows.length > 0 & water_tile<0.25*sq(mapsize)){
        let i_max = current_flows.length;
        for(let i = 0; i<i_max; i++){
          let flow = current_flows.shift();
          flow.flow();
          water_tile++;
        }
      }
    }
  }
  
  class Grow_tile_coal{
    constructor(_position, _max_value){
      this.position = _position;
      this.max_value = _max_value;
    }
    add_coal(){
      let h = map[round(this.position.x)][round(this.position.y)];
      let value = max(0,min(1,random(this.max_value-0.4,this.max_value*0.9)));
      h.ressources[3] = value;
    }
    create_children(){
      for(let i = 0; i<directions.length; i++){
        let new_positon = this.position.copy().add(directions[i]);
        let new_tile = new Grow_tile_coal(new_positon, this.max_value-0.2);
        if(new_tile.inBounds()){
          append(growing_patches_coal, new_tile);
        }
      }
    }
    inBounds(){
      if(this.max_value<=0){
        return false;
      }
      if(this.position.x<0 | this.position.y<0 | this.position.x>=mapsize | this.position.y>=mapsize){
        return false;
      }
      let h = map[round(this.position.x)][round(this.position.y)];
      if(h == null){
        return false;
      }
      if(h.ressources[3] != 0){
        return false;
      }
      for(let i = 0; i<growing_patches_coal.legth; i++){
        if(growing_patches_coal.get(i).position.copy().sub(this.position).mag()<0.5){
          return false;
        }
      }
      return true;
    }
  }
  
  let growing_patches_coal = [];
  
  function generate_coal(){
    let coal_tile = 0;
    while(coal_tile<0.3*sq(mapsize)){
      let randx = 0;
      let randy = 0;
      let seedTile = null;
      while(seedTile == null){
        randx = floor(random(mapsize));
        randy = floor(random(mapsize));
        seedTile = map[randx][randy];
      }
      coal_tile++;
      let seed_tile = new Grow_tile_coal(createVector(randx, randy), 1.5);
      append(growing_patches_coal, seed_tile);
      while(growing_patches_coal.length > 0){
        let i_max = growing_patches_coal.length;
        for(let i = 0; i<i_max; i++){
          let tile = growing_patches_coal[i];
          tile.add_coal();
          coal_tile++;
        }
        for(let i = 0; i<i_max; i++){
          let tile = growing_patches_coal.shift();
          tile.create_children();
        }
      }
    }
  }
  
  class Grow_tile_oil{
    constructor(_position){
      this.position = _position;
    }
    add_oil(){
      let h = map[round(this.position.x)][round(this.position.y)];
      let value = 1;
      h.ressources[4] = value;
    }
    create_children(){
      for(let i = 0; i<directions.length; i++){
        let new_positon = this.position.copy().add(directions[i]);
        let new_tile = new Grow_tile_oil(new_positon);
        if(new_tile.inBounds()){
          if(new_tile.isEligible()){
            append(growing_patches_oil, new_tile);
          }
        }
      }
    }
    inBounds(){
      if(this.position.x<0 | this.position.y<0 | this.position.x>=mapsize | this.position.y>=mapsize){
        return false;
      }
      let h = map[round(this.position.x)][round(this.position.y)];
      if(h == null){
        return false;
      }
      if(h.ressources[4] != 0){
        return false;
      }
      for(let i = 0; i<growing_patches_oil.length; i++){
        if(growing_patches_oil[i].position.copy().sub(this.position).mag()<0.5){
          return false;
        }
      }
      return true;
    }
    isEligible(){
      let count = 0;
      for(let i = 0; i<directions.length; i++){
        let new_positon = this.position.copy().add(directions[i]);
        if(new_positon.x<0 | new_positon.y<0 | new_positon.x>=mapsize | new_positon.y>=mapsize){
          continue;
        }
        let h = map[round(new_positon.x)][round(new_positon.y)];
        if(h == null){
          continue;
        }
        if(h.ressources[4]!=0){
          count++;
        }
      }
      let r = map[round(this.position.x)][round(this.position.y)].ressources;
      let a = r[0]+r[2]+r[3];
      if(count == 2 & random(20*a)<1){
        return true;
      }
      if(count == 1 & random(5*a)<1){
        return true;
      }
      return false;
    } 
  }
  
  let growing_patches_oil = [];
  
  function generate_oil_gas(){
    let oilpatches = 0;
    while(oilpatches<0.15*sq(mapsize)){
      let randx = 0;
      let randy = 0;
      let seedTile = null;
      while(seedTile == null){
        randx = floor(random(mapsize));
        randy = floor(random(mapsize));
        seedTile = map[randx][randy];
      }
      let seed_tile = new Grow_tile_oil(createVector(randx, randy));
      append(growing_patches_oil, seed_tile);
      while(growing_patches_oil.length > 0 & oilpatches<0.20*sq(mapsize)){
        let i_max = growing_patches_oil.length;
        for(let i = 0; i<i_max; i++){
          let tile = growing_patches_oil[i];
          tile.add_oil();
          oilpatches++;
        }
        for(let i = 0; i<i_max; i++){
          let tile = growing_patches_oil.shift();
          tile.create_children();
        }
      }
    }
    for(let i = 0; i<mapsize; i++){
      for(let j = 0; j<mapsize; j++){
        let h = map[i][j];
        if(h == null){
          continue;
        }
        let count = 0;
        let position = createVector(i, j);
        for(let k = 0; k<directions.length; k++){
          let new_positon = position.copy().add(directions[k]);
          if(new_positon.x<0 | new_positon.y<0 | new_positon.x>=mapsize | new_positon.y>=mapsize){
            continue;
          }
          let neighbour = map[round(new_positon.x)][round(new_positon.y)];
          if(neighbour == null){
            continue;
          }
          if(neighbour.ressources[4]!=0){
            count++;
          }
        }
        if(count >0){
          let a = count*(1-0.2*count*h.ressources[4]);
          if(a>2 | random(2)<1 | h.ressources[4]!=0){
            h.ressources[5] = max(0,min(1,random(a/10, a/3)));
          }
        }
        if(h.ressources[4]==1){
          h.ressources[4] = min(1,random(count*0.1, sqrt(count)*0.6));
        }
      }
    }
  }
  
  function generate_uranium(){
    let uranium_tile = 0;
    while(uranium_tile<0.05*sq(mapsize)){
      let randx = 0;
      let randy = 0;
      let seedTile = null;
      while(seedTile == null){
        randx = floor(random(mapsize));
        randy = floor(random(mapsize));
        seedTile = map[randx][randy];
      }
      let r = seedTile.ressources;
      if(r[0]+r[2]+r[3]+r[4]+r[5]>1.7){
        continue;
      }
      let min_value = 0.8;
      seedTile.ressources[6] = min(1,random(0.7,1.1));
      uranium_tile++;
      while(random(2)<1){
        min_value -= 0.2;
        let dir = directions[floor(random(6))];
        randx += dir.x;
        randy += dir.y;
        if(randx<0 | randy<0 | randx>=mapsize | randy>=mapsize){
          break;
        }
        let new_tile = map[randx][randy];
        if(new_tile == null){
          break;
        }
        if(new_tile.ressources[6] != 0){
          continue;
        }
        r = new_tile.ressources;
        if(r[0]+r[2]+r[3]+r[4]+r[5]>1.7){
          continue;
        }
        new_tile.ressources[6] = max(0,min(1,random(min_value,1.1)));
        uranium_tile++;
      }
    }
  }
  
  function generate_wind(){
    for(let i = 0; i<mapsize; i++){
      for(let j = 0; j<mapsize; j++){
        let h = map[i][j];
        if(h == null){
          continue;
        }
        let r = h.ressources;
        h.ressources[1] = max(random(0.15),min(random(0.7,1.1),1,2-(r[0]+r[2]+r[3]+r[4]+r[5]+r[6])));
        h.ressources[7] = r[0]+r[2]+r[3]+r[4]+r[5]+r[6]+h.ressources[1];
      }
    }
  }