# Daymark

Run Open Daymark.cmd on Windows, or run npm ci and npm run dev from web/.

[Set up Google sync and publish the site](docs/GOOGLE_SYNC_SETUP.md).

## Browser checks

From `web/`, run `npm ci`, `npx playwright install chromium`, `npm run build`, then `npm run test:browser`. The walkthrough serves the built app, opens isolated Chromium profiles and exercises real controls. To test a deployment, set `DAYMARK_TEST_URL` to its full site URL, including the trailing slash. The walkthrough uses device-only storage for its test records. GitHub Actions runs it before publication and again on the published URL. For Google sync and account isolation, use the separate [Firebase emulator walkthrough](docs/GOOGLE_SYNC_SETUP.md).
