void generate_table(){
  Table table = new Table();
  table.addColumn("q");
  table.addColumn("r");
  table.addColumn("solar");
  table.addColumn("wind");
  table.addColumn("hydro");
  table.addColumn("coal");
  table.addColumn("oil");
  table.addColumn("gas");
  table.addColumn("uranium");
  for(int i = 0; i<map.length; i++){
    Hex h = map[i];
    TableRow newRow = table.addRow();
    newRow.setFloat("q", h.q);
    newRow.setFloat("r", h.r);
    newRow.setFloat("solar", h.resources[0]); 
    newRow.setFloat("wind", h.resources[1]); 
    newRow.setFloat("hydro", h.resources[2]);
    newRow.setFloat("coal", h.resources[3]*500000000);
    newRow.setFloat("oil", h.resources[5]*24000000);
    newRow.setFloat("gas", h.resources[4]*140000000);
    newRow.setFloat("uranium", h.resources[6]*2000000);
  }
  saveTable(table, "map.csv");
}
