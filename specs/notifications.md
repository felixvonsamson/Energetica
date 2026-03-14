# Notification concept

## 1. Goals

The notification system informs players about relevant events in the game while avoiding information overload.

It should:

- Provide **feedback about important events** (construction completion, trade, achievements).
- Help players **react to time-sensitive situations** (money shortages, market activity).
- Allow players to **review past events** through a notification history.
- Enable **optional browser push notifications** to bring players back when something important happens.

---

# 2. Notification Channels

Energetica uses two complementary channels.

## 2.1 In-Game Notifications

Main notification system inside the game.

Accessed through a **notification icon (top right)** with an unread indicator.

Opening the menu displays a **chronological list of notifications**. New elements are displayed at the top of the list.

Each notification contains:

- category / icon
- title
- timestamp
- text content
- optional link to a relevant page

Example:

> (18:45)
> **Construction finished**
> Your Coal Burner is now operational.

Features:

- notifications are **marked as read when the menu is opened**
- players can **archive** and **flag** notifications
- filter options allow players to view specific categories

---

## 2.2 Browser Push Notifications

Configurable notifications sent through the browser when the player is **not actively in the game**.

Characteristics:

- must be **explicitly enabled**
- players can **choose categories** of push notifications
- clicking a notification opens the relevant game page

Push notifications should be reserved for **important or actionable events**.

Example:

> "Your wind farm construction is finished."

When push notifications are enabled, the system sends a **test notification** to confirm that they work.

---

# 3. Notification Categories

Notifications are grouped into categories that can be toggled for push notifications.

Proposed categories:

- Projects
- Resource Market
- Network
- Achievements

---

# 4. Notification Types

| Event                                     | In-Game Notification | Push Notification |
| ----------------------------------------- | -------------------- | ----------------- |
| Construction / project finished           | ✓                    | ✓                 |
| Player joined network                     | –                    | ✓                 |
| Player left network                       | –                    | ✓                 |
| Not enough money for market participation | ?                    | ✓                 |
| Natural resources sold to another player  | ✓                    | ✓                 |
| New bids on resource market               | ?                    | ✓                 |
| Facility decommissioned                   | ✓                    | ✓                 |
| Achievement unlocked                      | ✓                    | ✓                 |
| New player message                        | –                    | ✓                 |
| Tutorial hints                            | ✓                    | –                 |

---

# 5. Grouping and Anti-Spam

To avoid excessive notifications, the possibility to group similar events should be considered.

Push notification should not be grouped.

I suggest the following for the current day, have one notification per element. For the notification of the previous day and before, group similar events in daily updates.

For example :

> The following projects have been completed on the 13.04.2026:

- 12:56 - Steam Engine
- 15:09 - Coal burner
- 15:09 - Coal burner
- 23:33 - Mathematics 5
  >

---

# 6. Notification Settings

Players can configure notifications in **Settings → Notifications**.

Options include:

- Enable/disable browser push notifications
- Select categories for push notifications
- Configure custom warnings (e.g. money warnings, new bids on resource market, project slowed down)
