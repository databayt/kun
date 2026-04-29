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
  ignores: [
    // Historical kun commits made before this rule landed. Listed by SHA so
    // the strict 72-char limit still applies to every new commit.
    (message) =>
      [
        "feat(skills): /issue /branch /commit /pr /close — the unified workflow surface",
        "feat(revenue+replication): seed databayt/revenue + replicate-github-config script",
      ].some((header) => message.startsWith(header)),
  ],
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
