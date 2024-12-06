"""This module tests the solar performance of the system, comparing PV vs CSP.

PV (Photovoltaics) have a drop off in performance when the temperature gets too high.
CSP (Concentrated Solar Power) on the contrary have a drop off in performance when the temperature gets too low."""

# import numpy as np
import math
import os
import sys

import matplotlib.cm as cm
import matplotlib.pyplot as plt
import scipy.stats as stats

sys.path.append(os.getcwd())

# from energetica.database.map import Hex
from energetica.config.assets import const_config
from energetica.utils.misc import calculate_solar_irradiance
from map_generation.map_generation import calculate_solar_potentials

# import map_generation
# import energetica

if __name__ == "__main__":
    SEED = 0
    DAYS_TO_SIMULATE = 365 * 1
    SECONDS_BETWEEN_SAMPLES = 3600
    # list of in game seconds, one for each hour of the day
    time_of_day = [i for i in range(0, DAYS_TO_SIMULATE * 3600, SECONDS_BETWEEN_SAMPLES)]
    # dictionary from latitudes (r coordinates) to average power output for each hour of the day

    def uv_to_abc(u, v):
        return (
            (1 - 2 * u + u * v) / (2 * u * (1 - u)),
            (u * v - 1) / (2 * u * (1 - u)),
            (1 - u * v) / (2 * (1 - u)),
        )

    class Profile:
        def __init__(self, name, function):
            self.name = name
            self.function = function

    PV_BASE_POWER = (
        const_config["assets"]["PV_solar"]["base_power_generation"]
        / const_config["assets"]["PV_solar"]["base_price"]
        / const_config["assets"]["PV_solar"]["O&M_factor_per_day"]
    )
    CSP_BASE_POWER = (
        const_config["assets"]["CSP_solar"]["base_power_generation"]
        / const_config["assets"]["CSP_solar"]["base_price"]
        / const_config["assets"]["CSP_solar"]["O&M_factor_per_day"]
    )
    (u1, v1) = (0.2, 0.0)
    (a1, b1, c1) = uv_to_abc(u1, v1)
    profiles = [
        Profile(
            "PV_solar",
            lambda irradiance: irradiance * PV_BASE_POWER / 1000,
        ),
        Profile(
            "CSP_solar",
            lambda irradiance: irradiance * CSP_BASE_POWER / 1000,
        ),
        # Profile(
        #     "PV_solar_exp_decay",
        #     lambda irradiance: irradiance
        #     / 1000
        #     * 4
        #     * min(0.25, math.exp(-3 * irradiance / 1000))
        #     * PV_BASE_POWER
        #     * 1.3,
        # ),
        Profile(
            "PV_solar_linear_efficiency",
            lambda irradiance: 0.7 * irradiance * PV_BASE_POWER / 1000 * 20 / 3 * (0.3 - 0.15 * irradiance / 1000),
        ),
    ]

    latitudes = range(-10, 10 + 1)
    data_for_profile = {profile.name: [] for profile in profiles}
    irradiance_data = {r: [] for r in latitudes}
    for r in latitudes:
        print(f"Calculating for latitude {r}")
        x = 0
        y = r * 0.5 * 3**0.5
        power = {profile.name: [] for profile in profiles}
        for t in time_of_day:
            irradiance = calculate_solar_irradiance(x, y, t, SEED)
            irradiance_data[r].append(irradiance)
            for profile in profiles:
                power[profile.name].append(profile.function(irradiance))
        for profile in profiles:
            average_power = sum(power[profile.name]) / len(power[profile.name])
            data_for_profile[profile.name].append(average_power)

    # plot the average power output for each latitude
    for profile in profiles:
        plt.plot(latitudes, data_for_profile[profile.name], label=profile.name)
        print(f"Average power output for {profile.name}: {data_for_profile[profile.name]}")
    plt.xlabel("Latitude")
    plt.ylabel("Average power output (W)")
    plt.legend()
    plt.title("Average power output for each latitude")

    plt.figure()

    profile_a = profiles[-1]
    profile_b = profiles[1]
    plt.plot(
        latitudes,
        [x / y for x, y in zip(data_for_profile[profile_a.name], data_for_profile[profile_b.name])],
        label=f"{profile_a.name} / {profile_b.name}",
    )
    # Line at 1 for reference
    plt.axhline(y=1, color="black", linestyle="--")
    plt.xlabel("Latitude")
    plt.ylabel("relative normalized power output")
    plt.legend()
    plt.title("Relative performance of modified PV vs CSP")

    def irradiance_histograms():
        plt.figure("Irradiance histogram")
        for r in latitudes:
            THRESHOLD = 20
            irradiance_data[r] = [x for x in irradiance_data[r] if x > THRESHOLD]
            points_above_threshold = len(irradiance_data[r])
            density = stats.gaussian_kde(irradiance_data[r])
            x = range(20, 1200 + 1)
            color = cm.coolwarm((r - min(latitudes)) / (max(latitudes) - min(latitudes)))
            plt.plot(x, points_above_threshold * density(x), color=color, label=f"Latitude {r}")
        plt.xlabel("Irradiance (W/m^2)")
        plt.ylabel("Frequency")
        plt.legend()

    plt.show()
