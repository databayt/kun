---
name: Screenshot
description: View most recent screenshot from Desktop or Downloads
when_to_use: "Use when the most recent screenshot from Desktop or Downloads should be opened and read — usually a UI bug or design reference just captured. Triggers on: look at my screenshot, I just took a screenshot, check the image I saved, see the screen grab."
argument-hint: "[path]"
allowed-tools: ["Read", "Bash(ls *)"]
lane: build
effort: medium
---

# View Recent Screenshot

Find and display the most recent screenshot.

## Argument: $ARGUMENTS

## Instructions

1. If user provided a specific path, read that file directly
2. Otherwise, find most recent screenshot on Desktop:
   ```bash
   ls -t /Users/abdout/Desktop/Screenshot*.png 2>/dev/null | head -1
   ```
3. If not found, check Downloads:
   ```bash
   ls -t /Users/abdout/Downloads/Screenshot*.png 2>/dev/null | head -1
   ```
4. Display the screenshot and describe what you see
