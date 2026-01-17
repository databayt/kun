lsof -ti:3000 | xargs kill -9 2>/dev/null; open -a "Google Chrome" http://localhost:3000 && pnpm dev
