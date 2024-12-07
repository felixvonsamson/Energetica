/**
 * JS for power facilities, with support for a warning about high hydro facility costs
 */

/**
 * Show a warning for poor yields
 * @param {string} facility 
 * @param {boolean} high_hydro_cost
 * @param {boolean} low_wind_speed
 */
function launch_power_facility_project(facility, high_hydro_cost, low_wind_speed) {
    if (high_hydro_cost) {
        document.getElementById('are_you_sure_popup')?.classList.remove('hidden');
        // @ts-ignore
        const are_you_sure_content = document.getElementById('are_you_sure_content').innerHTML =
            `Build this hydro facility? High costs may outweigh benefits. 
            Learn more: <a href="/wiki/map#hydro_potential">Hydro Potential</a>.`;
        // @ts-ignore
        document.getElementById('yes_im_sure').onclick = () => {
            start_construction(facility, 'Power facilities');
            document.getElementById('are_you_sure_popup')?.classList.add('hidden');
        };
        const no_cancel = document.getElementById('no_cancel');
        // @ts-ignore
        no_cancel.innerHTML = '<b>Cancel</b>';
    } else if (low_wind_speed) {
        document.getElementById('are_you_sure_popup')?.classList.remove('hidden');
        // @ts-ignore
        const are_you_sure_content = document.getElementById('are_you_sure_content').innerHTML =
            `Build this wind facility? Low wind speeds will reduce yields. 
            Learn more: <a href="/wiki/map#wind_potential">Wind Potential</a>.
            `;
        // @ts-ignore
        document.getElementById('yes_im_sure').onclick = () => {
            start_construction(facility, 'Power facilities');
            document.getElementById('are_you_sure_popup')?.classList.add('hidden');
        };
        const no_cancel = document.getElementById('no_cancel');
        // @ts-ignore
        no_cancel.innerHTML = '<b>Cancel</b>';
    } else {
        start_construction(facility, 'Power facilities');
    }
}