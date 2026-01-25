# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

无影棚预约系统 - A lightweight photo studio booking system built with vanilla HTML/CSS/JavaScript. Uses localStorage for data persistence (migrated from Firebase → Supabase → localStorage). Supports PWA for offline use.

## Running the Application

**Local development:**
```bash
# Python 3
python -m http.server 8000

# Then visit http://localhost:8000
```

Or use VS Code Live Server extension.

**No build step required** - just open `index.html` directly or serve via any static file server.

## Architecture

### File Structure
```
无影棚预约/
├── index.html      # Single page application entry
├── app.js          # All business logic (1464 lines)
├── style.css       # All styles with responsive design
├── sw.js           # Service Worker for PWA/offline
├── manifest.json   # PWA configuration
└── vercel.json     # Deployment config (cache disabled)
```

### Core Data Model

**Booking object:**
```javascript
{
    id: string,           // Unique identifier
    studio: string,       // "无影棚1号" or "无影棚2号"
    date: string,         // YYYY-MM-DD
    startTime: string,    // HH:MM
    endTime: string,      // HH:MM
    photographer: string, // User name
    note: string,         // Booking notes
    createdAt: timestamp
}
```

### Key Global State (app.js)
- `currentUser` - Logged in user
- `allBookings` - All booking data array
- `currentView` - Active view (timeline/list/stats)
- `reminderInterval` - Reminder timer reference
- `notifiedBookings` - Set of already notified booking IDs

### Main Functional Modules

| Module | Key Functions |
|--------|---------------|
| Auth | `login()`, `logout()`, `showMainPage()` |
| Data | `loadBookings()`, `saveBookings()`, `addBooking()`, `deleteBooking()` |
| Views | `renderTimelineView()`, `renderBookings()`, `renderStatsView()` |
| Reminders | `startReminder()`, `checkReminders()`, `playSound()` |
| Mobile | `toggleSidebar()`, `closeSidebar()`, `initMobileSidebar()` |

### Data Flow
- Login: `login()` → save to localStorage → `showMainPage()` → `loadBookings()`
- Create booking: `addBooking()` → generate ID → save to localStorage → re-render views
- Reminder: `startReminder()` → check every second → match time → play sound + show alert

## Deployment

**Vercel:** Upload files or connect GitHub repo at vercel.com

**GitHub Pages:** Enable in repository settings

Cache is disabled in vercel.json to ensure real-time updates.

## Design System

- Primary color: #4C7DFF
- Background: #F7F9FC
- Mobile breakpoint: 768px
- Font: System font stack
