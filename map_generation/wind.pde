void generate_wind(){
  for(int i = 0; i<map.length; i++){
    Hex h = map[i];
    float[] r = h.resources;
    h.resources[1] = max(random(0.05, 0.25),min(random(0.5,1),1,2.4-(r[0]+r[2]+r[3]+r[4]+r[5]+r[6])));
    h.resources[7] = r[0]+r[2]+r[3]+r[4]+r[5]+r[6]+h.resources[1];
  }
}
