// Dedicated Cucumber config for the spec-gate verify flow (focusin-spec-runner).
//
// cucumber.mjs (the default config used by `npm run bdd`) sets
// `tags: "not @wip"` so day-to-day dev runs skip scenarios that are still
// mid-implementation elsewhere in the repo. But /spec:verify needs the
// opposite: a scenario a change just implemented is still tagged @wip
// (generate-features only clears the tag once record-results has seen a
// real pass/fail — see buildFeatureFile in spec_change.ts), so excluding
// @wip here would mean it can never appear in the report and record-results
// could never give it a first real result. This config is identical to
// cucumber.mjs except it omits that tag filter.
export default {
  paths: ["tests/cucumber/features/**/*.feature"],
  import: [
    "tests/cucumber/support/world.js",
    "tests/cucumber/step-definitions/**/*.js",
  ],
  publishQuiet: true,
  format: ["progress"],
};
