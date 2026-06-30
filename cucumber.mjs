export default {
  paths: ["tests/cucumber/features/**/*.feature"],
  import: [
    "tests/cucumber/support/world.js",
    "tests/cucumber/step-definitions/**/*.js",
  ],
  tags: "not @wip",
  publishQuiet: true,
  format: ["progress", "html:reports/cucumber/index.html"],
};
