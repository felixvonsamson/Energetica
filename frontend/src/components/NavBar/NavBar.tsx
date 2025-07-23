import { Link } from "@tanstack/react-router";

import styles from "./NavBar.module.css"

export default function NavBar() {
    return <nav className={styles.navbar}>
        <Link to='/admin-dashboard/map'>Map</Link>
        <Link to='/admin-dashboard/players'>Players</Link>
        <Link to='/admin-dashboard/networks'>Networks</Link>
        <Link to='/admin-dashboard/climate'>Climate</Link>
    </nav>
}