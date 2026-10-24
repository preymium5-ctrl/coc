# Raidroom

A responsive Clash of Clans companion dashboard in white, black, and blue, with authentic game artwork, player profiles, a battle journal, trophy charts, a personal loot leaderboard, and a playable video library.

## Run locally

Requires Node.js 20 or newer. No dependency installation or build is needed.

```powershell
npm start
```

Open `http://127.0.0.1:4173`. The static website is in `dist/`.

## Included behavior

- Clearly labeled sample village for initial exploration.
- Add and edit a personal player profile; starting a village clears sample battles.
- Import a real player profile JSON from the official API, including troop, spell, and hero levels. Each import saves a timestamped trophy snapshot.
- Manually log attacks and defenses with stars, destruction, loot, dates, trophy changes, and strategy notes.
- Filter and search attacks; paginate longer journals; inspect and delete records.
- Daily, weekly, and all-time loot rankings calculated from recorded gold and elixir. Dark elixir is reported separately. Rankings cover the local village, not the global player base.
- Trophy charts for seven or thirty days based on actual imported/edited snapshots.
- Save YouTube recordings or upload videos up to 100 MB and play them in the site. Local videos use IndexedDB; metadata and the journal use localStorage.
- JSON export and restore, with explicit confirmation before replacing records. Video binaries are excluded from exports; YouTube links are included.
- Responsive navigation, keyboard controls, reduced-motion support, labeled forms, and modal focus management through native dialogs.

## Official profile lookup

The included local Node server implements a server-only `GET /api/players/:tag` proxy. To enable it, set `COC_API_TOKEN` in the server's process environment before starting. Supercell requires the server's public IP address to be allowlisted for that key. No API credentials are sent to the browser or included in any artifact. Requests are cached for 60 seconds.

The hosted build is static: automatic API lookup and background synchronization are not connected there. Its account forms explain this, and users can track manually or import profiles. A player tag alone does not retrieve private information. No Supercell ID, password, or game login is needed.

The site does not fetch playable in-game replays or promise a complete historical multiplayer battle feed. The replay library plays user-supplied recordings and YouTube links.

Records are local to the browser, rather than shared or synchronized between devices. Clearing browser storage deletes local data. Export the journal and retain original video files separately.

## Checks

```powershell
npm run check
```

## Game artwork and design

The site uses a white canvas, black sidebar, and blue actions and charts. The official game renders retain their original colors.

- The hero and recording cover use the [official Clash of Clans game-page artwork](https://supercell.com/en/games/clashofclans/), downloaded unchanged from [Supercell's image CDN](https://supercell.com/images/ae58a39e76410b4ae9c2bea65d4a584d/hero_bg_clashofclans_.fae7c799.jpg) to `dist/assets/clash-official-banner.jpg`.
- Town Halls 1–18, six heroes, eight troops, four spells, and three resource images are real Supercell game assets distributed through [ClashKing Assets](https://github.com/ClashKingInc/ClashKingAssets). The images used by the sample village are included in `dist/assets/game/`; other imported units request their corresponding image from the documented `https://assets.clashk.ing/` CDN. If an image is unavailable, an accessible icon fallback is shown.
- Attribution to Supercell and ClashKing is visible in the footer. Supercell owns the game artwork. See [Supercell's Fan Content Policy](https://supercell.com/en/fan-content-policy/).

No generated fantasy artwork is used by the current site. The original illustration is preserved in the prior Git version.

## Unofficial fan content

This material is unofficial and is not endorsed by Supercell. For more information see [Supercell's Fan Content Policy](https://supercell.com/en/fan-content-policy/).
