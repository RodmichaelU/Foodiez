# Foodiez

Point your iPhone camera at the food you have, confirm the ingredients, and get recipes you can make right now.

See [BUILD_GUIDE.md](BUILD_GUIDE.md) for the product spec, architecture and build phases.

## Requirements

- Node 22.13 or newer (`nvm use` picks it up from `.nvmrc`)
- Python 3.11 or newer
- Expo Go on your iPhone, with the iPhone and laptop on the same Wi-Fi

## Set up the database

1. Create a Supabase project and copy its URL and keys into `backend/.env` and `mobile/.env`
2. In the Supabase SQL Editor, run `supabase/migrations/0001_initial_schema.sql`
3. Load the seed data from `backend/` with `.venv/bin/python -m scripts.seed`

Replace the sample recipes in `seed/chef_picks.json` with your own, then run the seed script again.

## Run the backend

```sh
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --host 0.0.0.0 --reload
```

Run the tests with `pytest` from `backend/`.

## Run the app

Find your laptop's local IP. On a Mac on Wi-Fi:

```sh
ipconfig getifaddr en0
```

Then:

```sh
cd mobile
npm install
cp .env.example .env   # set EXPO_PUBLIC_API_URL to http://<your-ip>:8000
npx expo start
```

Scan the QR code with the iPhone Camera app to open the project in Expo Go.

Your local IP can change when you switch networks. If the app stops connecting, check it again, update `mobile/.env`, and restart Expo.

## Troubleshooting

If Home cannot reach the backend:

1. Allow Local Network access for Expo Go in iPhone Settings
2. Allow incoming connections for Python in the macOS firewall
3. Open `http://<your-ip>:8000/health` in Safari on the iPhone to test the connection without the app
