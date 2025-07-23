import { Link } from "@tanstack/react-router";

import styles from "./NavBar.module.css"

export default function NavBar() {
    return <nav className={styles['navbar']}>
        <Link to='/admin-dashboard/map' className={styles['navbar-item']}>Map</Link>
        <Link to='/admin-dashboard/players' className={styles['navbar-item']}> Players</Link>
        <Link to='/admin-dashboard/networks' className={styles['navbar-item']}>Networks</Link>
        <Link to='/admin-dashboard/climate' className={styles['navbar-item']}>Climate</Link>
    </nav >
}