# Launch Daymark on GitHub Pages with Google sign-in

The browser app saves changes in IndexedDB immediately. People who select Google sync also get a private workspace in the owner's Firebase project. Their Google account identifies them. Daymark requests no Google Drive access. Local-only users can use all five screens without an account.

## Create the services once

Daymark's web app is already registered in **daymark-a3fb2**, and the source package includes its public configuration. The intended repository is [sandeep-kaki/daymark](https://github.com/sandeep-kaki/daymark). For this installation skip project and app registration, use **sandeep-kaki.github.io** as the authorized Pages domain, and leave the optional GitHub configuration variable unset to use the bundled settings.

1. In the [Firebase console](https://console.firebase.google.com/), create a project for Daymark on the Spark plan. Analytics is optional and Daymark does not use it. Register a **Web app** and copy its public firebaseConfig object. Keep service-account keys out of the repository and browser.
2. In **Authentication → Sign-in method**, enable Google and choose the support email. In **Firestore Database**, create the default database in Standard edition, select a region suitable for your users and start in production mode. Publish the contents of `firestore.rules` in the Rules tab. Alternatively, from this starter's root with an authenticated Firebase CLI, run `firebase deploy --only firestore:rules,firestore:indexes --project YOUR_PROJECT_ID`. The supplied index exemption avoids indexing the private text payload. If using the console alone, add a single-field exemption for the `text` field in collection group `parts`.
3. Create a fresh GitHub repository named **daymark**. For a free Pages site use a public repository. The app files are public. Personal records live in Firestore and access is enforced by the rules. Use the clean starter ZIP as the source and publish its **extracted contents**, including the hidden `.github` directory, at the repository root. GitHub Desktop can publish the folder as a new repository. The original checkout has a parent Git root containing other projects. [GitHub Pages availability](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
4. In GitHub **Settings → Pages → Build and deployment**, choose **GitHub Actions**. Under **Settings → Secrets and variables → Actions → Variables**, add the repository variable `DAYMARK_FIREBASE_CONFIG`. Paste the Firebase web settings as valid JSON with double quotes around keys and values, including `apiKey`, `authDomain`, `projectId` and `appId`.
5. In Firebase **Authentication → Settings → Authorized domains**, add `YOUR-GITHUB-NAME.github.io` (hostname only). For a custom domain, add that hostname. For testing locally, add `127.0.0.1` if using the bundled launcher. To test the **existing local workspace** with the same project, put the public JSON in `web/firebase-config.json` on your computer.
6. In GitHub **Actions → Publish Daymark → Run workflow**, run the workflow on the default branch. It builds and tests, then uploads only the static release. Open the URL shown by the successful deployment. A project named daymark normally appears at `https://YOUR-GITHUB-NAME.github.io/daymark/`. Repeat the workflow when publishing changes. [Pages deployment workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)

## First sign-in

Open **Settings → Continue with Google**. On a device with existing work, select **Copy this device’s saved records if my Google workspace is new** before signing in. The original device workspace stays available. A returning account downloads its cloud records automatically. Signing out reopens the separate device workspace. The Google account's cached data is retained in that browser so pending offline edits can sync on the next sign-in.

If your existing work is at the old local address, do the first sign-in **there** with the new Firebase configuration and copy option enabled. Wait for **Synced with Google**, then sign into the Pages site. The Pages origin cannot access another origin’s IndexedDB. Unsaved journal drafts stay with their browser and workspace.

Complete a task, open a second browser profile, sign in with the same Google account and inspect Journal. An edit made offline saves to that profile and synchronizes when Daymark is open and connected again. Distinct records merge automatically. If the same record was edited differently, Settings offers a whole-workspace choice before either version is overwritten. Downloading a file remains available as an optional transfer or recovery tool. Sync mirrors intentional deletions and does not provide historical backup snapshots.

## Storage and cost

One listener watches a small change marker per signed-in device. A Firestore transaction updates the marker and a set of content documents together. Large workspaces cost more reads and writes per sync. The current implementation supports 8 MiB of serialized workspace per account. Above that size it preserves the local copy and displays a sync error. Each user has an independent Firestore path, and the published rules allow individual reads and writes only for the signed-in owner.

For Standard edition the documented free allowance includes 1 GiB stored, 50,000 document reads per day and 20,000 writes per day across the project. Start on Spark and watch Usage while friends try it. On quota or network errors the app retains the device copy for retry. [Firestore quotas](https://firebase.google.com/docs/firestore/quotas)

## Local build and verification

With Node 22 or later, run `npm ci`, `npm run build`, `npm run check` and `npm test` from `web/`. Use `npm run dev` and open the printed address. An empty config provides local-only mode. The build compiles the Firebase browser SDK into the same-origin release and versions the offline cache using its contents. Production Pages builds require Firebase configuration.

For emulator testing, run `firebase emulators:start --project demo-daymark-sync --only auth,firestore` from the project root with a supported Java runtime. In another terminal run `node web/tests/firebase-sync.cjs` with Playwright and Chromium installed (`DAYMARK_PLAYWRIGHT` and `DAYMARK_CHROMIUM` can point to existing installations). The test uses fictional Google credentials accepted only by the local Auth emulator. Verify the live Google popup and real Pages domain once the owner-controlled services are connected.
