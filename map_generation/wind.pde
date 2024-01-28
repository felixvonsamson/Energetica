void generate_wind(){
  for(int i = 0; i<mapsize; i++){
    for(int j = 0; j<mapsize; j++){
      Hex h = map[i][j];
      if(h == null){
        continue;
      }
      float[] r = h.resources;
      h.resources[1] = max(random(0.15),min(random(0.7,1.1),1,2-(r[0]+r[2]+r[3]+r[4]+r[5]+r[6])));
      h.resources[7] = r[0]+r[2]+r[3]+r[4]+r[5]+r[6]+h.resources[1];
    }
  }
}
