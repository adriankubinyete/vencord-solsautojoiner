# SolsAutoJoiner

**SolsAutoJoiner** is a Vencord plugin for Discord that monitors specific channels for private Roblox server links and allows quick access to those servers.  
It was created for me, as an alternative to "selfbotting" snipers (which I personally don't like) and, as an integrated Vencord plugin, provides easier setup and smoother operation once installed.

---

## Key Features

- **Monitor multiple channels simultaneously**  
  Add the respective ChannelIDs to the `monitoredChannels` setting. You can monitor multiple channels by separating each ID with a comma. Example: `123,456,789`.

- **Background monitoring**  
  Channels do not need to be open in the chat for AutoJoin or notifications to work.

- **Quick biome configuration**  
  Enable the `showIcon` option to display a small cog button near the chat box. Clicking this button opens a menu to toggle desired biome detections.  
  - **Shift + Right-Click** the cog button to toggle AutoJoin without opening the menu.  
  - A green dot will appear near the cog when AutoJoin is active.
  (You can also configure the biomes through the plugin settings page if you have `showIcon` option disabled)

- **Joinable desktop notifications**  
  Receive clickable desktop notifications when a valid private server link is detected. Clicking the notification automatically opens the server.

- **Join upon detection**  
  AutoJoin allows immediate entry to valid server links. It is recommended to **disable AutoJoin after each join** to prevent accidental joins to new servers while already in-game.  
  - This can be automated using the `disableAutoJoinAfterEachServerJoin` setting.  
  - Re-enabling AutoJoin is as simple as Shift + Right-Clicking the cog button.

- **Fast server entry**  
  The plugin uses `roblox://` commands for joining, allowing faster server entry compared to opening the link in a web browser.

---

## Why AutoJoin is Disabled After Each Join

If multiple biomes trigger AutoJoin while you are already in a game, you risk being redirected to another server unexpectedly. Automatically disabling AutoJoin after each join prevents this.  
You can quickly re-enable it with Shift + Right-Click on the menu button, with a green dot indicating AutoJoin is active.

---

## Usage

1. Configure the ChannelIDs to monitor in the plugin settings.
2. Adjust the desired configuration: biomes to trigger, notifications, and AutoJoin options.
3. Enable `showIcon`, `showContext`, and `disableAutoJoinAfterEachServerJoin` for best experience.
4. Use the chat box cog menu to toggle biomes.
5. Shift + Right-Click the cog to enable AutoJoin without opening the menu. The green dot indicates it's active.
6. If AutoJoin triggers, join the server and complete your tasks. When finished, re-enable AutoJoin for the next link.

---

## Notes

- The plugin relies on Discord's client to receive message events. Only channels that have been visited or synchronized by the client can trigger AutoJoin and notifications.
- Ensure you review your biome and notification settings to avoid unintended joins.
- **Important:** The plugin does **not verify if the server belongs to Sol's RNG**. Only monitor trusted channels to avoid problematic situations.

---

## Post-notes
This project was severely vibe-coded with chatgpt and grok at like 3am in the morning. 
Made with ❤️ to whoever finds it useful.
