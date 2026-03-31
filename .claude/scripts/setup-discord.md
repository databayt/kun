# Discord Bot Setup for Databayt

## Steps (one-time, ~5 minutes)

### 1. Create Discord Application
Go to: https://discord.com/developers/applications
- Click "New Application" → Name: "Databayt Captain"
- Sidebar → Bot → Give username: "databayt-captain"
- Enable **Message Content Intent** under Privileged Gateway Intents

### 2. Get Bot Token
- Bot page → Token → Reset Token → Copy it (shown once)

### 3. Invite Bot to Server
- OAuth2 → URL Generator → Select `bot` scope
- Permissions: View Channels, Send Messages, Send Messages in Threads, Read Message History, Attach Files, Add Reactions
- Copy URL → Open → Add to databayt Discord server

### 4. Install Plugin (in Claude Code)
```
/plugin install discord@claude-plugins-official
```

### 5. Configure Token
```
/discord:configure <your-bot-token>
```

### 6. Launch with Discord Channel
```bash
claude --channels plugin:discord@claude-plugins-official
```

### 7. Pair Your Account
- DM the bot on Discord → Get pairing code
- In Claude Code: `/discord:access pair <code>`

### 8. Lock Down
```
/discord:access policy allowlist
```

## After Setup
The captain can:
- Receive messages from team on Discord
- Reply, react, and send files
- Dispatch updates to team channels
- Coordinate async work with Ali, Samia, Sedon
