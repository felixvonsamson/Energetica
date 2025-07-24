import { Link, useMatchRoute } from "@tanstack/react-router";
import clsx from "clsx"
import { ArrowUpDown, Leaf, Map, Settings, Users } from 'lucide-react';

import styles from "./NavBar.module.css"
import { ReactNode } from "react";

export default function NavBar() {
    return <nav className={styles['navbar']}>
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