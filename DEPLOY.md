# Deploy to Google Cloud Run

This guide puts the AI Adoption & Impact Tracker on the internet with Google Cloud Run, using Google Cloud Shell in your browser. You do not need to install anything on your computer.

The app runs in **demo mode**: no API key is needed, and the AI features show sample text built from the real numbers. An optional section at the end shows how to turn on live AI later.

Plan for about 15 minutes the first time.

## Before you start

You need:

- A Google account.
- A Google Cloud project with billing turned on. Cloud Run has a free tier, and a small demo like this usually stays inside it, but Google asks for a billing account before you can deploy. You can create a project at https://console.cloud.google.com/projectcreate.

Write down your **project ID** (it looks like `my-tracker-demo-123456`, not the display name). You will need it in step 2.

## Step 1. Open Cloud Shell

1. Go to https://console.cloud.google.com.
2. Click the **Activate Cloud Shell** button at the top right (a small terminal icon, `>_`).
3. A terminal opens at the bottom of the page. Wait until you see a prompt. If it asks you to authorize, click **Authorize**.

Every grey box below is one command. Copy it, paste it into Cloud Shell, and press Enter. Wait for each one to finish before running the next.

## Step 2. Choose your project

Replace `YOUR_PROJECT_ID` with your project ID:

```bash
gcloud config set project YOUR_PROJECT_ID
```

Choose a region close to you. This guide uses `us-central1`. To use another region, change it here and in the deploy command later:

```bash
gcloud config set run/region us-central1
```

## Step 3. Turn on the services Cloud Run needs

```bash
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
```

This can take a minute or two.

## Step 4. Get the code

Replace the address with your repository's address if you are deploying your own copy:

```bash
git clone https://github.com/jmims-workflow/ai-adoption-tracker.git
```

```bash
cd ai-adoption-tracker
```

If the repository is private, GitHub will ask for your username and a personal access token instead of your password. You can create a token at https://github.com/settings/tokens.

## Step 5. Deploy

```bash
gcloud run deploy ai-adoption-tracker --source . --region us-central1 --allow-unauthenticated
```

What this does:

- `--source .` sends the code in this folder to Google Cloud Build, which builds it using the `Dockerfile` in the repo.
- `--allow-unauthenticated` makes the site public, so anyone with the link can open it.

The first time, it may ask:

- **"Deploying from source requires an Artifact Registry Docker repository... Do you want to continue?"** Type `Y` and press Enter. It creates a place to store the built app.

The build takes a few minutes. When it finishes you will see a line like:

```
Service URL: https://ai-adoption-tracker-abc123xyz-uc.a.run.app
```

Open that URL. You should see the Overview page with the "Demo data" badge.

## Updating the site later

After you change the code (or pull new changes with `git pull`), run the same deploy command again from the `ai-adoption-tracker` folder:

```bash
gcloud run deploy ai-adoption-tracker --source . --region us-central1 --allow-unauthenticated
```

The URL stays the same.

## Good to know

- **The data resets.** The app stores data in a SQLite file inside the container. Cloud Run does not keep that file, so each time a new instance starts (after a deploy, or when the site wakes up after being idle) the demo data is reseeded. Pulse answers and imports made on the live site do not last. This is expected for the demo.
- **It may be slow to wake up.** If nobody has visited for a while, Cloud Run shuts the app down to save money. The next visit takes a few extra seconds while it starts.
- **Seeing errors.** To read the app's logs:

  ```bash
  gcloud run services logs read ai-adoption-tracker --region us-central1
  ```

- **Taking it down.** To delete the service so it no longer runs or costs anything:

  ```bash
  gcloud run services delete ai-adoption-tracker --region us-central1
  ```

## Optional: turn on live AI with an Anthropic API key

You can skip this whole section. The app works in demo mode without it.

To have the invite, leadership update and review summary written by Claude, give the app an `ANTHROPIC_API_KEY`. Store it in Secret Manager so the key never appears in your code, your terminal history or the Cloud Run settings page.

You need an API key from https://console.anthropic.com. Using it costs money on your Anthropic account.

### 1. Turn on Secret Manager

```bash
gcloud services enable secretmanager.googleapis.com
```

### 2. Store the key as a secret

Run this command. It waits for you to type, without showing your key on screen:

```bash
read -s -p "Paste your Anthropic API key, then press Enter: " KEY && printf "%s" "$KEY" | gcloud secrets create anthropic-api-key --data-file=- && unset KEY
```

Paste your key and press Enter. You should see `Created version [1] of the secret [anthropic-api-key].`

### 3. Let Cloud Run read the secret

First, find the account Cloud Run uses (by default, the Compute Engine default service account):

```bash
PROJECT_NUMBER=$(gcloud projects describe $(gcloud config get-value project) --format="value(projectNumber)")
```

Then give it permission to read only this secret:

```bash
gcloud secrets add-iam-policy-binding anthropic-api-key --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" --role="roles/secretmanager.secretAccessor"
```

### 4. Connect the secret to the app

```bash
gcloud run services update ai-adoption-tracker --region us-central1 --update-secrets=ANTHROPIC_API_KEY=anthropic-api-key:latest
```

Cloud Run restarts the app with the key. Open the site and click **Regenerate** on the leadership update. The "Sample text" note should no longer appear.

Future deploys with `gcloud run deploy ... --source .` keep this setting, so you do not need to repeat it.

### Changing or removing the key

To replace the key, add a new version, then restart the app so it picks it up:

```bash
read -s -p "Paste your new Anthropic API key, then press Enter: " KEY && printf "%s" "$KEY" | gcloud secrets versions add anthropic-api-key --data-file=- && unset KEY
```

```bash
gcloud run services update ai-adoption-tracker --region us-central1 --update-secrets=ANTHROPIC_API_KEY=anthropic-api-key:latest
```

To go back to demo mode:

```bash
gcloud run services update ai-adoption-tracker --region us-central1 --remove-secrets=ANTHROPIC_API_KEY
```
