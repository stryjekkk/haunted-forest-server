# Haunted Forest — online multiplayer Halloween game

A one-level browser game where up to 12 friends share a haunted forest, build spooky houses, add outdoor decorations, and hide from 5 wandering monsters. Monsters chase nearby players, deduct hearts and respawn players at the forest clearing after all hearts are lost. Houses, decorations, and player movement appear live for everyone in the same room.

## Run locally

Requires Node.js 18 or newer.

```bash
npm install
npm start
```

Open http://localhost:3000 in your browser.

## Play together online

Running on `localhost` is only available on your own computer. To invite someone elsewhere, deploy this folder to a Node.js host that supports WebSockets (such as Render, Railway, or a VPS). Set build command `npm install` and start command `npm start`; expose PORT (or let the host set it). Use the deployed HTTPS URL to open the game, create a room, and click **COPY INVITE**. Your friend opens that link to join the exact same forest.

Use **one server instance** for shared rooms. Rooms are stored in server memory; if the server restarts, the forest resets. Data is not saved long term. This version has anonymous room codes, not private authenticated accounts, and is suitable as a family-friendly prototype rather than a production secure social platform.

## Controls

* Desktop: WASD or arrow keys to move; **B** to build; **H** to enter/leave a nearby house; **1–5** to add Halloween decorations.
* Mobile: on-screen arrows and build/hide buttons; decorations via left panel.
* Build up to 3 houses per player in open areas.
* Add up to 50 outdoor decorations per player (pumpkin, ghost, grave, lantern, web).
* Chat with players in the same room through the in-game chat.

## Note on online hosting

Opening `public/index.html` as a local file will **not** connect to multiplayer. Start the server with Node.js and use its URL. On a deployed server, WSS is selected automatically under HTTPS.
