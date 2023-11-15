/* 
This code marks the current page in green in the navigation bar on the left.
*/

const activePage = window.location.pathname;
const navLinks = document.querySelectorAll("nav a").forEach((link) => {
  if (link.href.includes(`${activePage}`)) {
    link.classList.add("active");
    link.querySelector("img").classList.add("active");
  }
});