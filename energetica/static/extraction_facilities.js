/**
 * JS for extraction facilities, with support for a warning about poor yields
 */

/**
 * Show a warning for poor yields
 * @param {string} facility 
 * @param {boolean} poor_resource_production
 */
function launch_extraction_facility_project(facility, poor_resource_production) {
    if (poor_resource_production) {
        document.getElementById('are_you_sure_popup')?.classList.remove('hidden');
        const resource = {
            "coal_mine": "coal",
            "gas_drilling_site": "gas",
            "uranium_mine": "uranium",
        }[facility];
        // @ts-ignore
        const are_you_sure_content = document.getElementById('are_you_sure_content').innerHTML =
            `Are you sure you want to build this extraction facility?<br>
            Your location does not have much ${resource} and this extraction facility will have poor yield.`;
        // @ts-ignore
        document.getElementById('yes_im_sure').onclick = () => {
            start_construction(facility, 'Extraction Facilities');
            document.getElementById('are_you_sure_popup')?.classList.add('hidden');
        };
        const no_cancel = document.getElementById('no_cancel');
        // @ts-ignore
        no_cancel.innerHTML = '<b>Cancel</b>';
    } else {
        start_construction(facility, 'Extraction Facilities');
    }
}