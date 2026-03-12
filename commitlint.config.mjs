export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "scope-enum": [
      2,
      "always",
      [
        "plugin",
        "web",
        "landing",
        "mobile",
        "release-notes",
        "shared",
        "ci",
        "deps",
        "docker",
      ],
    ],
  },
};
