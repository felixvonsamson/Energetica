
function NavBar() {
  return (
    <nav className="navbar medium">
      <NavBarItem name="Dashboard" icon="dashboard.png" />
      <NavBarItem name="Profile" icon="profile.png" />
      <NavBarItem name="Production Overview" icon="dropdown.png" />
      <NavBarItem name="Facilities" icon="dropdown.png" />
      <NavBarItem name="Community" icon="dropdown.png" />
      <NavBarItem name="Technology" icon="technology.png" />
      <NavBarItem name="Resources Market" icon="resource_market.png" />
    </nav>
  );
};

function NavBarItem({ name, icon }: { name: string; icon: string; }) {
  return (
    <div className="navbar_item tan_green flex-row"
      key={name}>
      <img src={"/static/images/icons/" + icon}
        className="navbar_icon margin-small" />
      <span className="padding_vertical">{name}</span>
    </div>
  );
}

export default NavBar;
