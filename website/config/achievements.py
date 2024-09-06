"""This config file contains the data for the achievements that can be unlocked by the player."""

achievements = {
    "power_consumption": {
        "name": "Power Consumption",
        "metric": "max_power_consumption",
        "milestones": [10_000_000, 150_000_000, 6_500_000_000, 100_000_000_000, 3_000_000_000_000],
        "comparisons": [
            "a village in Europe",
            "the city of Basel",
            "Switzerland",
            "Japan",
            "the entire world population",
        ],
        "rewards": [5, 10, 15, 20, 25],  # XP
        "message": "You have passed the milestone of <span></span><script>document.currentScript.previousElementSibling"
        ".innerHTML = format_power({value});</script> of power consumption. You consume as much electricity as "
        "{comparison}. (+{reward} XP)",
        "requirements": [],
    },
    "energy_storage": {
        "name": "Energy Storage",
        "metric": "max_energy_stored",
        "milestones": [8_000_000_000, 160_000_000_000, 5_000_000_000_000],
        "comparisons": ["Zurich for a day", "switzerland for a day", "switzerland for a month"],
        "rewards": [5, 10, 20],
        "message": "You have stored <span></span><script>document.currentScript.previousElementSibling.innerHTML = "
        "format_energy({value});</script> of energy, enough to power {comparison}. (+{reward} XP)",
        "requirements": ["First Storage Facility"],
    },
    "mineral_extraction": {
        "name": "Mineral Extraction",
        "metric": "extracted_resources",
        "milestones": [500_000, 10_000_000, 200_000_000],
        "rewards": [5, 10, 15],
        "message": "You have extracted <span></span><script>document.currentScript.previousElementSibling.innerHTML = "
        "format_mass({value});</script> of resources. (+{reward} XP)",
        "requirements": ["Unlock Natural Resources", "Unlock Technologies"],
    },
    "network_import": {
        "name": "Network Import",
        "metric": "imported_energy",
        "milestones": [10_000_000_000, 200_000_000_000, 4_000_000_000_000],
        "rewards": [5, 10, 15],
        "message": "You have imported more than <span></span><script>document.currentScript.previousElementSibling"
        ".innerHTML = format_energy({value});</script> on the market. (+{reward} XP)",
        "requirements": ["Unlock Network"],
    },
    "network_export": {
        "name": "Network Export",
        "metric": "exported_energy",
        "milestones": [10_000_000_000, 200_000_000_000, 4_000_000_000_000],
        "rewards": [5, 10, 15],
        "message": "You have exported more than <span></span><script>document.currentScript.previousElementSibling"
        ".innerHTML = format_energy({value});</script> on the market. (+{reward} XP)",
        "requirements": ["Unlock Network"],
    },
    "technology": {
        "name": "Technology",
        "metric": "total_technologies",
        "milestones": [10, 25, 50, 100],
        "rewards": [5, 10, 15, 20],
        "message": "You have researched a total of {value} levels technologies. (+{reward} XP)",
        "requirements": ["Unlock Technologies"],
    },
    "trading": {
        "name": "Resource Trading",
        "metric": ["bought_resources", "sold_resources"],
        "milestones": [200_000, 5_000_000, 100_000_000],
        "rewards": [5, 10, 15],
        "message": "You have traded more than <span></span><script>document.currentScript.previousElementSibling"
        ".innerHTML = format_mass({value});</script> of resources. (+{reward} XP)",
        "requirements": ["Unlock Natural Resources"],
    },
    "network": {
        "name": "Unlock Network",
        "metric": "max_power_consumption",
        "milestones": [3_000_000],
        "rewards": [1],
        "message": "You generation capacities are now big enough to join a network and trade electricity. "
        "See <b>Community</b> > <b><a href='/network'>Network</a></b>. (+{reward} XP)",
        "requirements": [],
    },
    "laboratory": {
        "name": "Unlock Technologies",
        "unlocked_with": ["laboratory"],
        "reward": 1,
        "message": "You have built a laboratory, you can now research <a href='/technology'>technologies</a> "
        "to unlock new facilities or improve existing ones. (+{reward} XP)",
        "requirements": [],
    },
    "warehouse": {
        "name": "Unlock Natural Resources",
        "unlocked_with": ["warehouse"],
        "reward": 1,
        "message": "You have built a warehouse to store natural resources, you can now buy resources on the "
        "<a href='/resource_market'>resource market</a> or extract them yourself by building "
        "<a href='/extraction_facilities'>extraction facilities</a>. (+{reward} XP)",
        "requirements": [],
    },
    "GHG_effect": {
        "name": "Discover the Greenhouse Effect",
        "unlocked_with": ["chemistry"],
        "reward": 5,
        "message": "Scientists have discovered the greenhouse effect and have shown that climate change "
        "is caused by human activities and increases the risk of extreme weather events. You can now monitor "
        "your CO<sub>2</sub> emissions and the climate anomalies in the <a href='/production_overview/emissions'>"
        "emissions overview</a>. (+{reward} XP)",
        "requirements": ["Unlock Technologies"],
    },
    "storage_facilities": {
        "name": "First Storage Facility",
        "unlocked_with": [
            "small_pumped_hydro",
            "molten_salt",
            "large_pumped_hydro",
            "hydrogen_storage",
            "lithium_ion_batteries",
            "solid_state_batteries",
        ],
        "reward": 1,
        "message": "You have built your first storage facility, you can monitor the stored energy in the "
        "<a href='/production_overview/storage'>energy storage overview</a>. (+{reward} XP)",
        "requirements": [],
    },
}
