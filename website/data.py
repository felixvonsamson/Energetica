"""
---UNITS---
price : CHF
power production : W
construction time : s
construction energy : Wh
consumed ressource : [string]
amount consumed : [units]/h
pollution : g/kWh
"""

def display_CHF(price):
  return '{:,.0f} CHF'.format(price)

def display_W(power):
  units = ['W', 'kW', 'MW', 'GW', 'TW']
  unit_index = 0
  while power >= 1000:
      power /= 1000
      unit_index += 1
      if unit_index == len(units) - 1:
          break
  return '{:.0f} {}'.format(power, units[unit_index])

def display_duration(seconds):
  minutes, seconds = divmod(seconds, 60)
  hours, minutes = divmod(minutes, 60)
  days, hours = divmod(hours, 24)
  duration = []
  if days > 0:
      duration.append('{}d'.format(int(days)))
  if hours > 0:
      duration.append('{}h'.format(int(hours)))
  if minutes > 0:
      duration.append('{}m'.format(int(minutes)))
  if seconds > 0:
      duration.append('{}s'.format(int(seconds)))
  return ' '.join(duration)

def display_Wh(energy):
  units = ['Wh', 'kWh', 'MWh', 'GWh', 'TWh']
  unit_index = 0
  while energy >= 1000:
      energy /= 1000
      unit_index += 1
      if unit_index == len(units) - 1:
          break
  return '{:.0f} {}'.format(energy, units[unit_index])

def display_kg(mass):
  return '{:,.0f} kg/h'.format(mass)

energy_buildings = {
  "steam engine": {
    "price" : 20000,
    "power producrion" : 25000,
    "construction time" : 36000,
    "construction energy" : 10000,
    "consumed ressource" : "money",
    "amount consumed" : 100,
    "pollution" : 494
  },
  "windmill": {
    "price" : 15000,
    "power producrion" : 3000,
    "construction time" : 18000,
    "construction energy" : 3000,
    "consumed ressource" : "wind",
    "amount consumed" : 0,
    "pollution" : 0
  },
  "watermill": {
    "price" : 50000,
    "power producrion" : 10000,
    "construction time" : 36000,
    "construction energy" : 5000,
    "consumed ressource" : "water",
    "amount consumed" : 0,
    "pollution" : 0
  },
  "coal burner": {
    "price" : 5000000,
    "power producrion" : 120000000,
    "construction time" : 172800,
    "construction energy" : 17280,
    "consumed ressource" : "coal",
    "amount consumed" : 60000,
    "pollution" : 986
  },
  "oil burner": {
    "price" : 5000000,
    "power producrion" : 80000000,
    "construction time" : 172800,
    "construction energy" : 17280,
    "consumed ressource" : "oil",
    "amount consumed" : 21818,
    "pollution" : 777
  },
  "gas burner": {
    "price" : 5000000,
    "power producrion" : 100000000,
    "construction time" : 172800,
    "construction energy" : 17280,
    "consumed ressource" : "gas",
    "amount consumed" : 21818,
    "pollution" : 429
  },
  "shallow geothermal plant": {
    "price" : 1000000,
    "power producrion" : 350000,
    "construction time" : 172800,
    "construction energy" : 17280,
    "consumed ressource" : "geothermy",
    "amount consumed" : 0,
    "pollution" : 6
  },
  "small water dam": {
    "price" : 400000000,
    "power producrion" : 200000000,
    "construction time" : 172800,
    "construction energy" : 17280,
    "consumed ressource" : "hydropower",
    "amount consumed" : 0,
    "pollution" : 0
  },
  "small wind turbine": {
    "price" : 2000000,
    "power producrion" : 500000,
    "construction time" : 172800,
    "construction energy" : 17280,
    "consumed ressource" : "wind",
    "amount consumed" : 0,
    "pollution" : 0
  },
  "combined cycle": {
    "price" : 300000000,
    "power producrion" : 530000000,
    "construction time" : 172800,
    "construction energy" : 17280,
    "consumed ressource" : ["gas", "coal"],
    "amount consumed" : [60000, 9000],
    "pollution" : 488
  },
  "deep geothermal plant": {
    "price" : 250000000,
    "power producrion" : 120000000,
    "construction time" : 172800,
    "construction energy" : 17280,
    "consumed ressource" : "geothermy",
    "amount consumed" : 0,
    "pollution" : 10
  },
  "nuclear reactor": {
    "price" : 1000000000,
    "power producrion" : 900000000,
    "construction time" : 172800,
    "construction energy" : 17280,
    "consumed ressource" : "uranium",
    "amount consumed" : 360,
    "pollution" : 2
  },
  "large water dam": {
    "price" : 2000000000,
    "power producrion" : 1200000,
    "construction time" : 172800,
    "construction energy" : 17280,
    "consumed ressource" : "hydropower",
    "amount consumed" : 0,
    "pollution" : 0
  },
  "CSP solar": {
    "price" : 800000000,
    "power producrion" : 400000,
    "construction time" : 172800,
    "construction energy" : 17280,
    "consumed ressource" : "irradiation",
    "amount consumed" : 0,
    "pollution" : 0
  },
  "PV solar": {
    "price" : 1200,
    "power producrion" : 900,
    "construction time" : 172800,
    "construction energy" : 17280,
    "consumed ressource" : "irradiation",
    "amount consumed" : 0,
    "pollution" : 0
  },
  "large wind turbine": {
    "price" : 7000000,
    "power producrion" : 2500000,
    "construction time" : 172800,
    "construction energy" : 17280,
    "consumed ressource" : "wind",
    "amount consumed" : 0,
    "pollution" : 0
  },
  "nuclear reactor gen4": {
    "price" : 9000000000,
    "power producrion" : 2500000000,
    "construction time" : 172800,
    "construction energy" : 17280,
    "consumed ressource" : "uranium",
    "amount consumed" : 3,
    "pollution" : 2
  }
}