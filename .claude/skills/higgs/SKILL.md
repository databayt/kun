---
name: higgs
description: Generate and edit photos and videos for databayt org marketing, ads, and prompts using Higgsfield AI
when_to_use: "Use when you need to generate images or videos, or when you need to download a video from a URL, upload it to Higgsfield, and tweak/edit it for ads, promos, or marketing. Triggers on: /higgs, generate video, generate image, edit video from url, download and edit video, higgs ad generation."
argument-hint: "[--url <url>] [--prompt <text>] [--model <model>] [--output <path>]"
---

# Higgsfield AI Media Generation & Tweak Skill

This skill allows Claude Code and Antigravity/Gemini to leverage Higgsfield AI's models for generating studio-grade photos and videos for databayt's marketing campaigns, social media ads, and interactive prompts.

## 1. CLI Commands & Scripts

For downloading and editing external videos, we use the custom helper script:
`file:///Users/abdout/.claude/scripts/higgs-tweak.sh`

### How to use it:
```bash
# Example: Fetch an inspiration video and tweak its style
bash /Users/abdout/.claude/scripts/higgs-tweak.sh \
  --url "https://assets.mixkit.co/videos/preview/mixkit-dramatic-dark-clouds-sky-40742-large.mp4" \
  --prompt "Convert this clouds sky video into a vibrant glassmorphic synthwave background for a SaaS landing page ad, 8k, photorealistic" \
  --model "seedance_2_0" \
  --output "/Users/abdout/Downloads/databayt-ad.mp4"
```

## 2. Using Higgsfield MCP Tools directly

If you prefer to trigger generations directly inside Claude Code or Gemini via MCP (without going to the terminal), the `higgs` server is globally activated:
- **Claude mcp config**: `~/.claude/mcp.json`
- **Gemini mcp config**: `~/.gemini/config/mcp_config.json`

### Direct Prompting:
- *"Use the Higgs MCP tools to generate a dark mode photo of a developer workspace with neon lighting for our newsletter."*
- *"Use the Higgs generate tool to render a 5s Kling 3.0 video for a software dashboard mockup."*

## 3. Brand Identity Guidelines for databayt Ads & Marketing
When generating photos/videos for databayt, always instruct the model to incorporate:
- **Rich Aesthetics**: High-end glassmorphic UIs, glowing border effects, tailored HSL colors (avoiding flat primary reds/blues/greens).
- **Vibrant Gradients**: Deep dark mode backgrounds paired with warm sunset orange or electric cyan accents.
- **Premium Framing**: Dynamic camera movement (slow tracking shots, crane pushes, shallow depth of field) matching the "Cinema Studio" virtual lens logic.
