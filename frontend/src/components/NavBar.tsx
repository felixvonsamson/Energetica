import { useState } from 'react';

function NavBar() {
  return (
    <nav className="navbar medium">
      <ul className="navbar-nav">
        <NavBarItem name="Dashboard" icon="dashboard.png" />
        <NavBarItem name="Profile" icon="profile.png" />
        <NavBarSection name="Production Overview">
          <NavBarItem name="Revenues" icon="revenues.png" />
          <NavBarItem name="Electricity" icon="power_facilities.png" />
          <NavBarItem name="Storage" icon="storage_facilities.png" />
          <NavBarItem name="Resources" icon="resources.png" />
          <NavBarItem name="Emissions" icon="emissions.png" />
        </NavBarSection>
        <NavBarSection name="Facilities">
          <NavBarItem name="Power Facilities" icon="power_facilities.png" />
          <NavBarItem name="Storage Facilities" icon="storage_facilities.png" />
          <NavBarItem name="Extraction Facilities" icon="extraction_facilities.png" />
          <NavBarItem name="Functional Facilities" icon="functional_facilities.png" />
        </NavBarSection>
        <NavBarSection name="Community">
          <NavBarItem name="Messages" icon="messages.png" />
          <NavBarItem name="Network" icon="network.png" />
          <NavBarItem name="Map" icon="map.png" />
          <NavBarItem name="Scoreboard" icon="scoreboard.png" />
        </NavBarSection>
        <NavBarItem name="Technology" icon="technology.png" />
        <NavBarItem name="Resources Market" icon="resource_market.png" />
      </ul>
    </nav>
  );
};

function NavBarSection({ name, children }: { name: string; children: React.ReactNode; }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <li className="dropdown">
      <a className="navbar_item flex-row"
        onClick={() => (setExpanded(!expanded))}>
        <img src="/static/images/icons/dropdown.png"
          className={`navbar_icon margin-small ${expanded ? '' : 'rotate'}`} />
        <span className="padding_vertical">{name}</span>
      </a>
      <div className={`dropdown-menu ${expanded ? 'show' : ''}`}>
        {children}
      </div>
    </li >
  );
}

function NavBarItem({ name, icon }: { name: string; icon: string; }) {
  return (
    <a className="navbar_item flex-row"
      key={name}>
      <img src={"/static/images/icons/" + icon}
        className="navbar_icon margin-small" />
      <span className="padding_vertical">{name}</span>
    </a>
  );
}

export default NavBar;
