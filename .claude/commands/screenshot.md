# View Recent Screenshot

Find and display the most recent screenshot from the user's Desktop.

## Instructions

1. Find the most recent screenshot file on Desktop:
   ```bash
   ls -t /Users/abdout/Desktop/Screenshot*.png 2>/dev/null | head -1
   ```

2. If found, use the Read tool to view the screenshot image file

3. If no screenshot found on Desktop, check Downloads:
   ```bash
   ls -t /Users/abdout/Downloads/Screenshot*.png 2>/dev/null | head -1
   ```

4. Display the screenshot and describe what you see

5. If the user provided a specific path argument, read that file instead: $ARGUMENTS

## Notes
- macOS screenshots are named "Screenshot YYYY-MM-DD at HH.MM.SS.png"
- The Read tool can view PNG, JPG, and other image formats
- If user provides a path, use that path directly
