void generate_background_resources(){
  for(int i = 0; i<map.length; i++){
    Hex h = map[i];
    if(h.resources[2] == 0){
      h.resources[2] = random(0.01, 0.2);
    }
    if(h.resources[3] == 0){
      h.resources[3] = max(0, random(-0.015, 0.12));
    }
    if(h.resources[4] == 0){
      h.resources[4] = max(0, random(-0.04, 0.18));
    }
    if(h.resources[5] == 0){
      h.resources[5] = max(0, random(-0.03, 0.15));
    }
    if(h.resources[6] == 0){
      h.resources[6] = min(1, abs(0.1 * randomGaussian()));
    }
  }
}
