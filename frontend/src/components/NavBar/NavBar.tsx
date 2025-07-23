import { Link, useMatchRoute } from "@tanstack/react-router";
import clsx from "clsx"

import styles from "./NavBar.module.css"

export default function NavBar() {
    return <nav className={styles['navbar']}>
        <NavBarItem to='/admin-dashboard/map' text="Map" />
        <NavBarItem to='/admin-dashboard/players' text="Players" />
        <NavBarItem to='/admin-dashboard/networks' text="Networks" />
        <NavBarItem to='/admin-dashboard/climate' text="Climate" />
    </nav >
}

function NavBarItem({ to, text }: { to: string, text: string }) {
    const matchRoute = useMatchRoute()
    const isActive = matchRoute({ to })
    return <Link to={to} className={clsx(styles['navbar-item'], { [styles.active]: isActive })}>
        {text}
    </Link>
}