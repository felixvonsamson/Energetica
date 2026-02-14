# Wiki Link Check

**Server:** http://localhost:5173
**Result:** All 30 links OK ✓

## Link Check

| | Status | Link | Source |
|---|---|---|---|
| ✓ | `route` | /app/overviews/emissions | climate-effects |
| ✓ | `skip` | #heatwave | climate-effects |
| ✓ | `file` | ./functional-facilities.mdx#carbon-capture | climate-effects |
| ✓ | `route` | /app/community/map | climate-effects, map |
| ✓ | `file` | ./time-and-weather.mdx#game-time | climate-effects, functional-facilities, power-facilities, resources |
| ✓ | `200` | /static/images/wiki/heatwave_probability_distribution.png | climate-effects |
| ✓ | `200` | /static/images/wiki/coldwave_probability_distribution.png | climate-effects |
| ✓ | `200` | /static/images/wiki/wildfire_probability_distribution.png | climate-effects |
| ✓ | `200` | /static/images/wiki/expected_occurrence_flood.jpg | climate-effects |
| ✓ | `200` | /static/images/wiki/expected_occurrence_hurricane.jpg | climate-effects |
| ✓ | `file` | ./projects.mdx#starting-a-project | functional-facilities, power-facilities, resources, storage-facilities |
| ✓ | `route` | /app/facilities/functional | functional-facilities, projects |
| ✓ | `file` | ./technologies.mdx | functional-facilities, power-facilities, projects |
| ✓ | `file` | ./power-facilities.mdx#solar-power-generation | map, time-and-weather |
| ✓ | `file` | ./resources.mdx#extraction-facilities | map, projects |
| ✓ | `file` | ./climate-effects.mdx#climate-events | map |
| ✓ | `route` | /app/community/electricity-markets | network, power-management |
| ✓ | `route` | /app/dashboard | power-facilities, projects, time-and-weather |
| ✓ | `file` | ./map.mdx#wind-potential | power-facilities |
| ✓ | `file` | ./power-management.mdx | power-facilities |
| ✓ | `route` | /app/facilities/technology#thermodynamics | power-facilities |
| ✓ | `file` | ./network.mdx | power-management |
| ✓ | `route` | /app/facilities/manage | projects |
| ✓ | `route` | /app/overviews/cash-flow | projects |
| ✓ | `file` | ./storage-facilities.mdx | projects |
| ✓ | `route` | /app/facilities/power | projects |
| ✓ | `route` | /app/facilities/storage | projects |
| ✓ | `route` | /app/facilities/extraction | projects |
| ✓ | `route` | /app/community/resource-market | projects |
| ✓ | `route` | /app/overviews/resources | resources |

## Flowchart

```mermaid
flowchart LR
    climate_effects["Climate Effects"]
    functional_facilities["Functional Facilities"]
    introduction["Introduction"]
    map["Map"]
    network["Network"]
    power_facilities["Power Facilities"]
    power_management["Power Management"]
    projects["Projects"]
    resources["Resources"]
    storage_facilities["Storage Facilities"]
    technologies["Technologies"]
    time_and_weather["Time And Weather"]

    climate_effects --> functional_facilities
    climate_effects --> time_and_weather
    functional_facilities --> projects
    functional_facilities --> time_and_weather
    functional_facilities --> technologies
    map --> power_facilities
    map --> resources
    map --> climate_effects
    power_facilities --> technologies
    power_facilities --> projects
    power_facilities --> time_and_weather
    power_facilities --> map
    power_facilities --> power_management
    power_facilities --> climate_effects
    power_management --> power_facilities
    power_management --> network
    projects --> power_facilities
    projects --> storage_facilities
    projects --> resources
    projects --> functional_facilities
    projects --> technologies
    resources --> map
    resources --> power_facilities
    resources --> functional_facilities
    resources --> projects
    resources --> time_and_weather
    storage_facilities --> projects
    storage_facilities --> power_facilities
    technologies --> functional_facilities
    technologies --> power_facilities
    time_and_weather --> power_facilities
```

## Mindmap

```mermaid
mindmap
  root((Wiki))
    Climate Effects
      Functional Facilities
      Time And Weather
    Functional Facilities
      Projects
      Time And Weather
      Technologies
    Introduction
    Map
      Power Facilities
      Resources
      Climate Effects
    Network
    Power Facilities
      Technologies
      Projects
      Time And Weather
      Map
      Power Management
      Climate Effects
    Power Management
      Power Facilities
      Network
    Projects
      Power Facilities
      Storage Facilities
      Resources
      Functional Facilities
      Technologies
    Resources
      Map
      Power Facilities
      Functional Facilities
      Projects
      Time And Weather
    Storage Facilities
      Projects
      Power Facilities
    Technologies
      Functional Facilities
      Power Facilities
    Time And Weather
      Power Facilities
```
