import { ReactNode } from "react";
import { Link, useMatchRoute } from "@tanstack/react-router";
import clsx from "clsx";
import { ArrowUpDown, Leaf, Map, Settings, Users } from 'lucide-react';

import styles from "./NavBar.module.css";

import energeticaLogo from "../../assets/icon_green.svg";

export default function NavBar() {
    return <nav className={styles['navbar']}>
        <div className={styles['logo-container']}>
            <img src={energeticaLogo} className={styles["logo"]} alt="Energetica logo" />
            <h1 className={styles["fancy-title"]} >
                Energetica
            </h1>
        </div>
        <NavBarItem to='/admin-dashboard/map'>
            <Map />
            Map
        </NavBarItem>
        <NavBarItem to='/admin-dashboard/players'>
            <Users />
            Players
        </NavBarItem>
        <NavBarItem to='/admin-dashboard/networks'>
            <ArrowUpDown />
            Networks
        </NavBarItem>
        <NavBarItem to='/admin-dashboard/climate'>
            <Leaf />
            Climate
        </NavBarItem>
        <NavBarItem to='/admin-dashboard/settings' className={styles['settings']}>
            <Settings />
            Settings
        </NavBarItem>
    </nav >
}

function NavBarItem({
    to,
    className,
    children
}: {
    to: string;
    className?: string;
    children: ReactNode;
}) {
    const matchRoute = useMatchRoute()
    const isActive = matchRoute({ to })

    return (
        <Link
            to={to}
            className={clsx(styles['navbar-item'], className, {
                [styles.active]: isActive,
            })}
        >
            {children}
        </Link>
    )
}