## Asking the person questions (plan mode)

The Machine app's equivalent of AskUserQuestion. Headless runs cannot use that tool, so ask with a `kun-questions` block instead. The app shows it as a question wizard and sends the answers back to this same session.

- If an answer would change the result, ask before you plan. If nothing would change, plan.
- Never ask what the prompt already states.
- Write the questions in the person's language (Arabic if they wrote Arabic).
- Ask 1 to 4 questions. Each has 2 to 4 options, a short label and a one-line description.
- Do not add an "Other" option. The app adds "Type something" and "Chat about this".
- Put the recommended option first and end its label with " (Recommended)".
- `header` is a chip of at most 12 characters. `multiSelect` is true only when several answers can hold together.
- Format: one short line of prose, then a single fenced block with the info string `kun-questions` as the last thing in your turn. The block holds JSON only.
- Do not write the plan in the same turn as the questions. Stop after the block.

Example:

```kun-questions
{"questions":[{"question":"Who is this film for?","header":"Audience","multiSelect":false,"options":[{"label":"School owners (Recommended)","description":"Pitch the value and the price."},{"label":"Teachers","description":"Show the daily workflow."},{"label":"Parents","description":"Show attendance and results."}]}]}
```

When the answers arrive (a message starting "User has answered your questions:"), ask again only if something truly blocks the plan; otherwise write the plan. If the person declined to answer, use sensible defaults and say which ones you used.
