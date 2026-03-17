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

Main notification system inside the game. Think of it as an **email inbox**: a persistent, reviewable record of events.

Accessed through a **notification icon (top right)** with an unread count badge.

Opening the dialog displays a **chronological list of notifications**, newest first.

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

- Notifications are **marked as read when the panel is opened**
- **Mark all as read** action available
- Players can **flag** notifications for easy visual identification (flagged items stand out in the list)
- Players can **archive** notifications (removes from inbox view without deleting; all notifications persist for the duration of the season)
- Filter options allow players to view specific categories, or view archived notifications

---

## 2.2 Browser Push Notifications

Configurable notifications sent through the browser when the player is **not actively in the game**.

Characteristics:

- Must be **explicitly enabled** by the player
- Players can **choose categories** of push notifications
- Clicking a push notification opens the relevant game page

Push notifications should be reserved for **important or actionable events**.

Example:

> "Your wind farm construction is finished."

When push notifications are enabled, the system immediately sends a **test notification** to confirm that they work.

---

## 2.3 Relationship to the Messaging System

The in-game player messaging system is a **separate channel** — more like IM than email. New messages surface via a **badge on the message icon**, not as entries in the notification inbox. Push notifications for new messages are supported (see Section 4).

---

# 3. Notification Categories

Notifications are grouped into categories used for filtering and push notification configuration.

| Category        | Covers                                         |
| --------------- | ---------------------------------------------- |
| Projects        | Construction finished, facility decommissioned |
| Resource Market | Resources sold, market warnings                |
| Network         | Players joining / leaving the network          |
| Achievements    | Achievement unlocked, tutorial hints           |

---

# 4. Notification Types

Some notification types are **opt-in**: they can be toggled directly in the relevant area of the game (e.g. a bell icon on the Resource Market page), and separately configured for push in Settings. Opt-in types are off by default unless noted.

| Event                                     | Category        | In-Game        | Push | Notes                                   |
| ----------------------------------------- | --------------- | -------------- | ---- | --------------------------------------- |
| Construction / project finished           | Projects        | ✓              | ✓    |                                         |
| Facility decommissioned                   | Projects        | ✓              | ✓    |                                         |
| Player joined network                     | Network         | ✓              | ✓    |                                         |
| Player left network                       | Network         | ✓              | ✓    |                                         |
| Natural resources sold to another player  | Resource Market | ✓              | ✓    |                                         |
| New bids on resource market               | Resource Market | opt-in (bell)  | ✓    | Toggle on the Resource Market page      |
| Not enough money for market participation | Resource Market | opt-in (bell)  | ✓    | Same mechanism; on by default           |
| Achievement unlocked                      | Achievements    | ✓              | ✓    |                                         |
| Tutorial hints                            | Achievements    | ✓              | –    |                                         |
| New player message                        | –               | – (badge only) | ✓    | Separate messaging system; not in inbox |

---

# 5. Grouping and Anti-Spam

To avoid inbox clutter, players can configure a **grouping mode** per notification type (where it makes sense). The two modes are:

- **Immediate**: one notification per event, as it happens (default for most types)
- **Grouped**: similar events are batched into periodic digests

When grouped mode is enabled, sensible default frequencies apply (e.g. daily digest). Players can configure the frequency.

Grouped digest example:

> **Projects completed — 13.04.2026**
>
> - 12:56 Steam Engine
> - 15:09 Coal Burner
> - 15:09 Coal Burner
> - 23:33 Mathematics 5

Grouping applies to **in-game notifications only**. Push notifications are always immediate and not grouped.

> Note: grouping logic is the least-defined feature in this spec and will need further design work before implementation.

---

# 6. Notification Settings

Players can configure notifications in **Settings → Notifications**.

Options include:

- Enable/disable browser push notifications
- Select categories for push notifications
- Configure grouping mode and frequency per notification type
- Configure custom warning thresholds (e.g. minimum money balance for warnings)
