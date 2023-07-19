/* 
This code generates the progress bars on top of the pages that show the buildings under construction
*/

//CHANGE TO p5.js
function formatMilliseconds(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const days = Math.floor(totalSeconds / (3600 * 24));
  const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  let formattedTime = '';
  if (days > 0) {
    formattedTime += `${days}d `;
  }
  if (days > 0 || hours > 0) {
    formattedTime += `${hours}h `;
  }
  if (days > 0 || hours > 0 || minutes > 0) {
    formattedTime += `${minutes}m `;
  }
  formattedTime += `${seconds}s`;

  return formattedTime.trim();
};


const update_countdowns = () => {
  const matches = document.querySelectorAll(".time");
  matches.forEach((el) => {
    const finish_time = el.dataset.name;
    const now = new Date().getTime();
    if(finish_time*1000<now){
      el.parentElement.style.display='none';
    }else{
    const time = formatMilliseconds(finish_time*1000-now);
    el.innerText = `(${time})`;
    };
  });
};

update_countdowns();
setInterval(update_countdowns, 1000);