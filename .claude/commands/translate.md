Arabic/English translation workflow for content.

Arguments: $ARGUMENTS (file path or text to translate, and direction: "ar" for Arabic→English, "en" for English→Arabic)

Steps:
1. Read the source content
2. Identify the direction (Arabic→English or English→Arabic)
3. Translate with attention to:
   - Technical terms: Keep consistent with existing translations in the codebase
   - RTL/LTR: Note any layout implications
   - Cultural context: Adapt idioms and references for target audience
   - Saudi market: Use Saudi Arabic dialect preferences where appropriate
4. For code/docs: Preserve code blocks, only translate comments and prose
5. For UI strings: Match existing dictionary patterns from src/dictionaries/
6. Output both versions side-by-side for Samia's review

Reference: internationalization agent for i18n patterns
Samia is the primary reviewer for all translations.
