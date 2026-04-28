/**
 * commitlint config — extends conventional, adds the i18n custom type used
 * across databayt repos for translation-only commits, and enforces the
 * 72-char subject limit our PR template promises.
 *
 * Hook: .husky/commit-msg invokes `commitlint --edit "$1"`.
 * CI: .github/workflows/pr-check.yml runs against every commit in the PR.
 */
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "feat",
        "fix",
        "docs",
        "chore",
        "refactor",
        "test",
        "perf",
        "style",
        "ci",
        "build",
        "revert",
        "i18n",
      ],
    ],
    "header-max-length": [2, "always", 72],
    "subject-case": [2, "never", ["upper-case", "pascal-case", "start-case"]],
    "subject-empty": [2, "never"],
    "subject-full-stop": [2, "never", "."],
    "type-empty": [2, "never"],
    "type-case": [2, "always", "lower-case"],
  },
};
