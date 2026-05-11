// ─────────────────────────────────────────────────────────────────
//  Flare API config
// ─────────────────────────────────────────────────────────────────
//  To enable real flight lookups:
//  1. Go to https://rapidapi.com and create a free account
//  2. Search for "AeroDataBox" and subscribe to the FREE tier
//     (500 calls/month, no credit card needed)
//  3. Copy your RapidAPI key from the AeroDataBox page and paste below
// ─────────────────────────────────────────────────────────────────

export const RAPIDAPI_KEY = '07407c72e4mshc3e7af0f184c476p1b4f4bjsnff84521b0006';

// ─────────────────────────────────────────────────────────────────
//  Google Cloud Vision API key — used for boarding pass / screenshot OCR
//  Free tier: 1,000 requests/month, resets monthly
//  Setup:
//  1. Go to console.cloud.google.com
//  2. Create a project → enable "Cloud Vision API"
//  3. APIs & Services → Credentials → Create API Key
//  4. Paste it below
// ─────────────────────────────────────────────────────────────────

export const GOOGLE_CLOUD_VISION_KEY = 'AIzaSyC9exASLrYNLvJwrEGKbEGm13qSmvPXw7o';
