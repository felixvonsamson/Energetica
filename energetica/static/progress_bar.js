/* 
This code generates the progress bars on top of the pages that show the facilities under construction
*/


/** 
* @type { typeof import('./sockets.js') } 
* @type { typeof import('./toasts.js') } 
* @type { typeof import('./notifications.js') } 
*/;

const asset_names = {
  "steam_engine": "Steam Engine",
  "windmill": "Windmill",
  "watermill": "Watermill",
  "coal_burner": "Coal Burner",
  "gas_burner": "Gas Burner",
  "small_water_dam": "Small Water Dam",
  "onshore_wind_turbine": "Onshore Wind Turbine",
  "combined_cycle": "Combined Cycle",
  "nuclear_reactor": "Nuclear Reactor",
  "large_water_dam": "Large Water Dam",
  "CSP_solar": "Concentrated Solar Power",
  "PV_solar": "Photovoltaics",
  "offshore_wind_turbine": "Offshore Wind Turbine",
  "nuclear_reactor_gen4": "4th Generation Nuclear",
  "small_pumped_hydro": "Small Pumped Hydro",
  "molten_salt": "Molten Salt",
  "large_pumped_hydro": "Large Pumped Hydro",
  "hydrogen_storage": "Hydrogen Hydrolysis",
  "lithium_ion_batteries": "Lithium-Ion Batteries",
  "solid_state_batteries": "Solid State Batteries",
  "laboratory": "Laboratory",
  "warehouse": "Warehouse",
  "industry": "Industry",
  "carbon_capture": "Carbon Capture",
  "coal_mine": "Coal Mine",
  "gas_drilling_site": "Gas Drilling Site",
  "uranium_mine": "Uranium Mine",
  "mathematics": "Mathematics",
  "mechanical_engineering": "Mechanical Engineering",
  "thermodynamics": "Thermodynamics",
  "physics": "Physics",
  "building_technology": "Building Technology",
  "mineral_extraction": "Mineral Extraction",
  "transport_technology": "Transport Technology",
  "materials": "Materials",
  "civil_engineering": "Civil Engineering",
  "aerodynamics": "Aerodynamics",
  "chemistry": "Chemistry",
  "nuclear_engineering": "Nuclear Engineering",
};

const resource_names = {
  "coal": "Coal",
  "gas": "Gas",
  "uranium": "Uranium",
};

function format_ticks(ticks) {
  const totalSeconds = ticks * in_game_seconds_per_tick;
  return format_seconds(totalSeconds, show_seconds = false);
}

function format_ticks_real_time(ticks) {
  const totalSeconds = ticks * clock_time;
  return format_seconds(totalSeconds);
}

function format_seconds(totalSeconds, show_seconds = true) {
  const days = Math.floor(totalSeconds / (3600 * 24));
  const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  let formattedTime = "";
  if (days > 0) {
    formattedTime += `${days}d `;
  }
  if (days > 0 || hours > 0) {
    formattedTime += `${hours}h `;
  }
  if (days > 0 || hours > 0 || minutes > 0) {
    formattedTime += `${minutes}m `;
  }
  if (show_seconds) {
    formattedTime += `${seconds}s`;
  }

  return formattedTime.trim();
}

// information sent to the server when a new facility is created
function start_construction(facility, force = false) {
  send_json(`/api/v1/projects?force=${force}`, { type: facility })
    .then((response) => {
      response.json().then((body) => {
        if (catchValidationErrors(response, body)) return;
        if (catchGameErrors(response, body)) return;
        if (response.ok) {
          refreshMoney();
          retrieve_constructions();
          refresh_progressBar();
          addToast("Construction started");
        } else if (response.status === 300) {
          are_you_sure_start_construction(facility, body.capacity, body.constructionPower);
        }
      });
    })
    .catch((error) => {
      console.error(`caught error ${error}`);
    });
}

function cancel_construction(construction_id, force = false) {
  send_json(`/api/v1/projects/${construction_id}?force=${force}`, {}, "DELETE")
    .then((response) => {
      response.json().then((body) => {
        if (catchValidationErrors(response, body)) return;
        if (catchGameErrors(response, body)) return;
        if (response.status === 204) {
          addToast("Construction cancelled");
          refreshMoney();
          sessionStorage.setItem(
            "constructions",
            JSON.stringify(body)
          );
          refresh_progressBar();
        } else if (response.status === 300) {
          if (body.type == "HasDependents") {
            const dependents = body.dependents;
            has_dependents_cancel_construction(construction_id, dependents);
          } else if (body.type == "areYouSure") {
            const refund = body.refund;
            are_you_sure_cancel_construction(construction_id, refund);
          } else {
            addError("Something went wrong");
          }
        } else {
          addError("Something went wrong");
        }
      });
    })
    .catch((error) => {
      console.error(`caught error ${error}`);
    });
}

function pause_construction(projectId) {
  send_json(`/api/v1/projects/${projectId}:pause`, { id: projectId })
    .then((response) => {
      response.json().then((body) => {
        if (catchGameErrors(response, body)) return;
        if (response.status === 200) {
          sessionStorage.setItem(
            "constructions",
            JSON.stringify(body)
          );
          refresh_progressBar();
        }
      });
    })
    .catch((error) => {
      console.error(`caught error ${error}`);
    });
}

function resume_construction(projectId) {
  send_json(`/api/v1/projects/${projectId}:resume`, { id: projectId })
    .then((response) => {
      response.json().then((body) => {
        if (catchGameErrors(response, body)) return;
        if (response.status === 200) {
          sessionStorage.setItem(
            "constructions",
            JSON.stringify(body)
          );
          refresh_progressBar();
        }
      });
    })
    .catch((error) => {
      console.error(`caught error ${error}`);
    });
}

function decrease_project_priority(project_id) {
  send_json(`/api/v1/projects/${project_id}:decrease-priority`, {})
    .then((response) => {
      response.json().then((body) => {
        if (catchGameErrors(response, body)) return;
        if (response.status === 200) {
          sessionStorage.setItem(
            "constructions",
            JSON.stringify(body)
          );
          refresh_progressBar();
        } else {
          addError("An unknown error occurred.");
        }
      });
    })
    .catch((error) => {
      console.error(`caught error ${error}`);
    });
}

function increase_project_priority(project_id) {
  send_json(`/api/v1/projects/${project_id}:increase-priority`, {})
    .then((response) => {
      response.json().then((body) => {
        if (catchGameErrors(response, body)) return;
        if (response.status === 200) {
          sessionStorage.setItem(
            "constructions",
            JSON.stringify(body)
          );
          refresh_progressBar();
        } else {
          addError("An unknown error occurred.");
        }
      });
    })
    .catch((error) => {
      console.error(`caught error ${error}`);
    });
}

let projectsData, shipment_data;
let progressBars = document.getElementsByClassName("progressbar-bar");
let shipmentBars = document.getElementsByClassName("shipmentbar-bar");
setInterval(() => {
  load_constructions().then((projectsData) => {

    for (const progressBar of progressBars) {
      const construction = projectsData.projects.find((project) => project.id === Number(progressBar.id));
      if (construction == null) {
        console.error("Construction ");
        throw new Error(`Could not find construction with id ${progressBar.id}`);
      }
      const now = new Date().getTime() / 1000;
      const current_tick = (now - first_tick_time) / clock_time + 1;
      let new_width;
      let ticks_remaining;
      const last_tick = JSON.parse(sessionStorage.getItem("last_value")).total_t;
      let time_since_last_tick = current_tick - last_tick;
      if (construction.status == 2) {
        ticks_remaining = construction.endTick - last_tick - time_since_last_tick * construction.speed;
        new_width = (1 - ticks_remaining / construction.duration) * 100;
      } else {
        new_width = (construction.ticksPassed / construction.duration) * 100;
        ticks_remaining = construction.duration - construction.ticksPassed;
      }
      progressBar.style.setProperty("--width", new_width);
      if (new_width > 0.01) {
        if (construction.speed < 0.01) {
          progressBar.classList.add("red");
        }
        else if (construction.speed < 0.99) {
          progressBar.classList.add("orange");
        }
        else {
          progressBar.classList.add("pine");
        }
      }
      if (ticks_remaining > construction.duration) {
        progressBar.innerHTML = '&nbsp; Starting...';
      }
      else if (ticks_remaining < 0) {
        progressBar.innerHTML = '&nbsp; Finishing...';
      }
      else {
        const time = format_ticks(ticks_remaining);
        const real_time = format_ticks_real_time(ticks_remaining);
        progressBar.innerHTML = `&nbsp; <span class="hover_info">${time}<span class="popup_info small">in-game time</span></span> &ensp; <span class="transparency_txt hover_info">(${real_time})<span class="popup_info small">real time</span></span>`;
      }
    }
    for (const shipmentBar of shipmentBars) {
      const id = shipmentBar.id;
      const shipment = shipment_data.shipments.find((shipment) => shipment.id == id);
      const now = new Date().getTime() / 1000;
      const current_tick = (now - first_tick_time) / clock_time + 1;
      let new_width;
      let ticks_remaining;
      ticks_remaining = shipment.arrival_tick - current_tick;
      new_width = (1 - ticks_remaining / shipment.duration) * 100;
      shipmentBar.style.setProperty("--width", new_width);
      if (new_width > 0.01) {
        if (shipment.speed < 0.01) {
          shipmentBar.classList.add("red");
        }
        else if (shipment.speed < 0.99) {
          shipmentBar.classList.add("orange");
        }
        else {
          shipmentBar.classList.add("pine");
        }
      }
      if (ticks_remaining > shipment.duration) {
        shipmentBar.innerHTML = '&nbsp; Starting...';
      }
      else if (ticks_remaining < 0) {
        shipmentBar.innerHTML = '&nbsp; Finishing...';
      }
      else {
        const time = format_ticks(ticks_remaining);
        const real_time = format_ticks_real_time(ticks_remaining);
        shipmentBar.innerHTML = `&nbsp; <span class="hover_info">${time}<span class="popup_info small">in-game time</span></span> &ensp; <span class="transparency_txt hover_info">(${real_time})<span class="popup_info small">real time</span></span>`;
      }
    }
  });
}, 100);

function refresh_progressBar() {
  // TODO(mglst): this function can REFRESH progress bars, but is not capable of CREATING or REMOVING html elements.
  // e.g. this works when pausing and resuming projects, but not when queueing a new project or canceling one.
  load_constructions().then((projectsData) => {
    load_shipments().then((shipment_list) => {
      shipment_data = shipment_list;
      display_progressBars(projectsData, shipment_data);
    });
  });
}

function display_progressBars(projectsData, shipment_data) {
  if (document.title == "Dashboard") {
    if (projectsData != null) {
      const uc = document.getElementById("under_construction");
      const ur = document.getElementById("under_research");
      if (uc === null || ur === null) return;
      uc.innerHTML = "";
      ur.innerHTML = "";
      const constructionQueue = projectsData.constructionQueue;
      const researchQueue = projectsData.researchQueue;
      if (constructionQueue.length > 0) {
        uc.innerHTML = "<h1>&ensp;<img src='/static/images/icons/construction.png' class='icon'/>&nbsp;Ongoing Constructions</h1>";
      }
      if (researchQueue.length > 0) {
        ur.innerHTML = "<h1>&ensp;<img src='/static/images/icons/technology.png' class='icon'/>&nbsp;Ongoing Researches</h1>";
      }
      for (const [index, projectId] of researchQueue.entries()) {
        const construction = projectsData.projects.find((project) => project.id === projectId);
        ur.innerHTML += html_for_progressBar(index, researchQueue, construction);
      }
      for (const [index, projectId] of constructionQueue.entries()) {
        const construction = projectsData.projects.find((project) => project.id === projectId);
        uc.innerHTML += html_for_progressBar(index, constructionQueue, construction);
      }
    }
    if (shipment_data != null) {
      const us = document.getElementById("shipments");
      if (us === null) return;
      us.innerHTML = "";
      if (shipment_data.shipments.length > 0) {
        us.innerHTML = "<h1>&ensp;<img src='/static/images/icons/resource_market.png' class='icon'/>&nbsp;Ongoing Shipments</h1>";
      }
      shipment_data.shipments.forEach(shipment => {
        us.innerHTML += html_for_shipmentBar(shipment.id, shipment);
      });
    }
  } else {
    const uc = document.getElementById("under_construction");
    if (uc != null) {
      if (document.title == "Resource Market" && shipment_data != null) {
        uc.innerHTML = "";
        shipment_data.shipments.forEach(shipment => {
          uc.innerHTML += html_for_shipmentBar(shipment.id, shipment);
        });
        return;
      }
      if (projectsData != null) {
        uc.innerHTML = "";
        const projectsQueue = (
          document.title == "Technologies" ? projectsData.researchQueue : projectsData.constructionQueue
        );
        for (const [projectIndex, projectId] of projectsQueue.entries()) {
          const project = projectsData.projects.find((project) => project.id === projectId);
          uc.innerHTML += html_for_progressBar(projectIndex, projectsQueue, project);
        }
      }
    }
  }
}


/**
 * @param {number} projectIndex
 * @param {number[]} projectsQueue
 * @param {{ id: number; type: string; status: number; speed: number; level: number | null }} project
 */
function html_for_progressBar(projectIndex, projectsQueue, project) {
  if (project == null) {
    throw Error("html_for_progressBar: project is null");
  }
  let playPauseLogo = "fa-pause";
  const togglePauseButtonFunctionName = project.status === 2 ? "pause_construction" : "resume_construction";
  if (project.status == 0) {
    playPauseLogo = "fa-play";
  }
  if (project.status == 1) {
    playPauseLogo = "fa-hourglass-half";
  }
  let snail = "";
  if (project.speed < 0.01) {
    snail = `<div class="progressbar-name medium">
            <span class="hover_info"><img src="/static/images/icons/snail_house.png" class="icon"/><span class="popup_info small">Energy Shortage</span>
        </div>`;
  } else if (project.speed < 0.99) {
    snail = `<div class="progressbar-name medium">
            <span class="hover_info"><img src="/static/images/icons/snail.png" class="icon"/><span class="popup_info small">Energy Shortage</span>
        </div>`;
  }
  return `
    <div class="progressbar-container">
        <div class="progressbar-arrowcontainer">
            ${projectIndex > 0 ? `
                <button class="progressbar-arrow progressbar-button" onclick="increase_project_priority(${project.id})">
                    <i class="fa fa-caret-up"></i>
                </button>` : ''}
            ${projectIndex + 1 != projectsQueue.length ? `
                <button class="progressbar-arrow progressbar-button" onclick="decrease_project_priority(${project.id})">
                    <i class="fa fa-caret-down"></i>
                </button>` : ''}
        </div>
        <div class="progressbar-name medium margin-small">${asset_names[project.type]}${project.level !== null ? " " + project.level : ""}</div>
        ${snail}
        <div class="progressbar-background">
            <div id="${project.id}" class="progressbar-bar"></div>
        </div>
        <button class="progressbar-icon progressbar-button" onclick="${togglePauseButtonFunctionName}(${project.id})">
            <i class="fa ${playPauseLogo}"></i>
        </button>
        <button class="progressbar-icon progressbar-button" onclick="cancel_construction(${project.id})">
            <i class="fa fa-times"></i>
        </button>
    </div>`;
}

function html_for_shipmentBar(id, shipment) {
  let snail = "";
  if (shipment["speed"] < 0.01) {
    snail = `<div class="progressbar-name medium">
            <span class="hover_info"><img src="/static/images/icons/snail_house.png" class="icon"/><span class="popup_info small">Energy Shortage</span>
        </div>`;
  } else if (shipment.speed < 0.99) {
    snail = `<div class="progressbar-name medium">
            <span class="hover_info"><img src="/static/images/icons/snail.png" class="icon"/><span class="popup_info small">Energy Shortage</span>
        </div>`;
  }
  return `<div class="progressbar-container">
        <div class="progressbar-name medium margin-small">${format_mass(shipment.quantity)} ${resource_names[shipment.resource]}</div>
        ${snail}
        <div class="progressbar-background">
            <div id="${id}" class="shipmentbar-bar"></div>
        </div>
    </div>`;
}