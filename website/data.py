data = {

"power buildings": {
  "steam engine": {
    "price" : 20000, #[CHF]
    "power production" : 25000, #[W]
    "construction time" : 36000, #[s]
    "construction energy" : 10000, #[Wh]
    "construction pollution" : 12000, #[kg]
    "consumed ressource" : "money",
    "amount consumed" : 100,
    "pollution" : 494 #[g/kW]
  },
  "windmill": {
    "price" : 15000,
    "power production" : 3000,
    "construction time" : 18000,
    "construction energy" : 3000,
    "construction pollution" : 12000,
    "consumed ressource" : "wind",
    "amount consumed" : 0,
    "pollution" : 0
  },
  "watermill": {
    "price" : 50000,
    "power production" : 10000,
    "construction time" : 36000,
    "construction energy" : 5000,
    "construction pollution" : 12000,
    "consumed ressource" : "water",
    "amount consumed" : 0,
    "pollution" : 0
  },
  "coal burner": {
    "price" : 5000000,
    "power production" : 120000000,
    "construction time" : 172800,
    "construction energy" : 17280,
    "construction pollution" : 12000,
    "consumed ressource" : "coal",
    "amount consumed" : 60000,
    "pollution" : 986
  },
  "oil burner": {
    "price" : 5000000,
    "power production" : 80000000,
    "construction time" : 172800,
    "construction energy" : 17280,
    "construction pollution" : 12000,
    "consumed ressource" : "oil",
    "amount consumed" : 21818,
    "pollution" : 777
  },
  "gas burner": {
    "price" : 5000000,
    "power production" : 100000000,
    "construction time" : 172800,
    "construction energy" : 17280,
    "construction pollution" : 12000,
    "consumed ressource" : "gas",
    "amount consumed" : 21818,
    "pollution" : 429
  },
  "shallow geothermal plant": {
    "price" : 1000000,
    "power production" : 350000,
    "construction time" : 172800,
    "construction energy" : 17280,
    "construction pollution" : 12000,
    "consumed ressource" : "geothermy",
    "amount consumed" : 0,
    "pollution" : 6
  },
  "small water dam": {
    "price" : 400000000,
    "power production" : 200000000,
    "construction time" : 172800,
    "construction energy" : 17280,
    "construction pollution" : 12000,
    "consumed ressource" : "hydropower",
    "amount consumed" : 0,
    "pollution" : 0
  },
  "wind turbine": {
    "price" : 2000000,
    "power production" : 500000,
    "construction time" : 172800,
    "construction energy" : 17280,
    "construction pollution" : 12000,
    "consumed ressource" : "wind",
    "amount consumed" : 0,
    "pollution" : 0
  },
  "combined cycle": {
    "price" : 300000000,
    "power production" : 530000000,
    "construction time" : 172800,
    "construction energy" : 17280,
    "construction pollution" : 12000,
    "consumed ressource" : ["gas", "coal"],
    "amount consumed" : [60000, 9000],
    "pollution" : 488
  },
  "deep geothermal plant": {
    "price" : 250000000,
    "power production" : 120000000,
    "construction time" : 172800,
    "construction energy" : 17280,
    "construction pollution" : 12000,
    "consumed ressource" : "geothermy",
    "amount consumed" : 0,
    "pollution" : 10
  },
  "nuclear reactor": {
    "price" : 1000000000,
    "power production" : 900000000,
    "construction time" : 172800,
    "construction energy" : 17280,
    "construction pollution" : 12000,
    "consumed ressource" : "uranium",
    "amount consumed" : 360,
    "pollution" : 2
  },
  "large water dam": {
    "price" : 2000000000,
    "power production" : 1200000000,
    "construction time" : 172800,
    "construction energy" : 17280,
    "construction pollution" : 12000,
    "consumed ressource" : "hydropower",
    "amount consumed" : 0,
    "pollution" : 0
  },
  "CSP solar": {
    "price" : 800000000,
    "power production" : 400000,
    "construction time" : 172800,
    "construction energy" : 17280,
    "construction pollution" : 12000,
    "consumed ressource" : "irradiation",
    "amount consumed" : 0,
    "pollution" : 0
  },
  "PV solar": {
    "price" : 1200,
    "power production" : 900,
    "construction time" : 172800,
    "construction energy" : 17280,
    "construction pollution" : 12000,
    "consumed ressource" : "irradiation",
    "amount consumed" : 0,
    "pollution" : 0
  },
  "large wind turbine": {
    "price" : 7000000,
    "power production" : 2500000,
    "construction time" : 172800,
    "construction energy" : 17280,
    "construction pollution" : 12000,
    "consumed ressource" : "wind",
    "amount consumed" : 0,
    "pollution" : 0
  },
  "nuclear reactor gen4": {
    "price" : 9000000000,
    "power production" : 2500000000,
    "construction time" : 172800,
    "construction energy" : 17280,
    "construction pollution" : 12000,
    "consumed ressource" : "uranium",
    "amount consumed" : 3,
    "pollution" : 2
  }
},

"storage buildings": {
  "small pumped hydro": {
    "price" : 400000000, #[CHF]
    "storage capacity" : 3000000000, #[Wh]
    "power production" : 55000000, #[W]
    "efficiency" : 0.75,
    "construction time" : 36000, #[s]
    "construction energy" : 10000, #[Wh]
    "construction pollution" : 12000 #[kg]
  },
  "compressed air": {
    "price" : 1200000000,
    "storage capacity" : 100000000,
    "power production" : 20000000,
    "efficiency" : 0.60,
    "construction time" : 36000,
    "construction energy" : 10000,
    "construction pollution" : 12000
  },
  "molten salt": {
    "price" : 30000000,
    "storage capacity" : 600000000,
    "power production" : 240000000,
    "efficiency" : 0.92,
    "construction time" : 36000,
    "construction energy" : 10000,
    "construction pollution" : 12000
  },
  "large pumped hydro": {
    "price" : 1300000000,
    "storage capacity" : 16000000000,
    "power production" : 400000000,
    "efficiency" : 0.8,
    "construction time" : 36000,
    "construction energy" : 10000,
    "construction pollution" : 12000
  },
  "hydrogen storage": {
    "price" : 7000000,
    "storage capacity" : 80000000000000,
    "power production" : 750000000,
    "efficiency" : 0.4,
    "construction time" : 36000,
    "construction energy" : 10000,
    "construction pollution" : 12000
  },
  "lithium ion batteries": {
    "price" : 150000000,
    "storage capacity" : 100000000,
    "power production" : 20000000,
    "efficiency" : 0.98,
    "construction time" : 36000,
    "construction energy" : 10000,
    "construction pollution" : 12000
  },
  "solid state batteries": {
    "price" : 350000000,
    "storage capacity" : 140000000,
    "power production" : 30000000,
    "efficiency" : 0.99,
    "construction time" : 36000,
    "construction energy" : 10000,
    "construction pollution" : 12000
  }
},

"functional buildings": {
  "laboratory": {
    "price" : 2500000, #[CHF]
    "construction time" : 36000, #[s]
    "construction energy" : 10000, #[Wh]
    "construction pollution" : 12000 #[kg]
  },
  "warehouse": {
    "price" : 400000,
    "construction time" : 36000,
    "construction energy" : 10000,
    "construction pollution" : 12000
  },
  "military barracks": {
    "price" : 80000000,
    "construction time" : 36000,
    "construction energy" : 10000,
    "construction pollution" : 12000
  },
},

"extraction plants": {
  "coal mine": {
    "price" : 2500000, #[CHF]
    "construction time" : 36000, #[s]
    "construction energy" : 10000, #[Wh]
    "construction pollution" : 12000, #[kg]
    "amount produced" : 3000, #[kg/h]
    "power consumption" : 3000, #[W]
    "pollution" : 2 #[kg/h]
  },
  "oil extraction plant": {
    "price" : 2500000,
    "construction time" : 36000,
    "construction energy" : 10000,
    "construction pollution" : 12000,
    "amount produced" : 3000,
    "power consumption" : 3000,
    "pollution" : 2
  },
  "gas extraction plant": {
    "price" : 2500000,
    "construction time" : 36000,
    "construction energy" : 10000,
    "construction pollution" : 12000,
    "amount produced" : 3000,
    "power consumption" : 3000,
    "pollution" : 2
  },
  "uranium mine": {
    "price" : 2500000,
    "construction time" : 36000,
    "construction energy" : 10000,
    "construction pollution" : 12000,
    "amount produced" : 3000,
    "power consumption" : 3000,
    "pollution" : 2
  }
},

"technology": {
  "mineral extraction": {
    "initial price" : 40000, #[CHF]
    "price multiplier" : 1.3,
    "research time" : 36000, #[s]
    "research energy" : 10000, #[Wh]
  },
  "civil engeneering": {
    "initial price" : 40000,
    "price multiplier" : 1.3,
    "research time" : 36000,
    "research energy" : 10000,
  },
  "physics": {
    "initial price" : 40000,
    "price multiplier" : 1.3,
    "research time" : 36000,
    "research energy" : 10000,
  },
  "materials": {
    "initial price" : 40000,
    "price multiplier" : 1.3,
    "research time" : 36000,
    "research energy" : 10000,
  },
  "carbon capture": {
    "initial price" : 40000,
    "price multiplier" : 1.3,
    "research time" : 36000,
    "research energy" : 10000,
  },
  "transport technology": {
    "initial price" : 40000,
    "price multiplier" : 1.3,
    "research time" : 36000,
    "research energy" : 10000,
  },
  "aerodynamics": {
    "initial price" : 40000,
    "price multiplier" : 1.3,
    "research time" : 36000,
    "research energy" : 10000,
  }
}

}