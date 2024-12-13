document.addEventListener("scroll", () => {
  const scrollPosition = window.scrollY; // Get the vertical scroll position
  const rotationAngle = scrollPosition * 0.1; // Adjust the multiplier for desired speed
  // Apply rotation to the left and right images
  document.querySelectorAll(".logo").forEach((logo, index) => {
    const direction = index % 2 === 0 ? -1 : 1; // Rotate left or right differently
    logo.style.transform = `rotate(${rotationAngle * direction}deg)`;
  });
});

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: "smooth" });
}
