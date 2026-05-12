// Shared Firebase AI Logic init for the AI Field Lab apps.
// Each app imports this and calls `getModel()` to get a Gemini handle.
//
// IMPORTANT — before deploy:
//   1. Replace firebaseConfig below with your project's values from
//      Firebase Console → Project Settings → General → "Your apps" → Web app config.
//   2. (Recommended) Enable App Check with reCAPTCHA Enterprise so the
//      browser SDK can't be abused. Replace RECAPTCHA_SITE_KEY below.
//   3. Enable the "Vertex AI in Firebase" or "Gemini Developer API" SDK
//      for your project in the Firebase Console → AI Logic section.

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import { getAI, getGenerativeModel, GoogleAIBackend } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-ai.js";
import { initializeAppCheck, ReCaptchaV3Provider } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app-check.js";

const firebaseConfig = {
  apiKey: "AIzaSyB7U4hvqBS-VBMPoQs4l9fpOAUyF7Ztj84",
  authDomain: "threat-modeling-workbench.firebaseapp.com",
  projectId: "threat-modeling-workbench",
  storageBucket: "threat-modeling-workbench.firebasestorage.app",
  messagingSenderId: "631725887073",
  appId: "1:631725887073:web:b18472f5619a9a9de62420",
  measurementId: "G-7RHW2KHZT8"
};

const RECAPTCHA_SITE_KEY = "6Lf7ouYsAAAAAKJ2AgL3wdJgRFAXKANT644gQxdc";
const APP_CHECK_ENABLED = true; // flip to true once reCAPTCHA Enterprise is set up

export const app = initializeApp(firebaseConfig);

if (APP_CHECK_ENABLED) {
  try {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(RECAPTCHA_SITE_KEY),
      isTokenAutoRefreshEnabled: true
    });
  } catch (e) {
    console.warn("App Check init failed:", e);
  }
}

const ai = getAI(app, { backend: new GoogleAIBackend() });

/**
 * Get a configured Gemini model.
 * @param {object} opts
 * @param {string} [opts.model="gemini-2.0-flash"] — model name
 * @param {string} [opts.systemInstruction] — system prompt to anchor the persona
 * @param {object} [opts.generationConfig] — temperature, response_mime_type, etc.
 */
export function getModel({ model = "gemini-2.5-flash", systemInstruction, generationConfig } = {}) {
  return getGenerativeModel(ai, {
    model,
    systemInstruction,
    generationConfig
  });
}

/**
 * Convenience wrapper: send a prompt, get plain text back.
 * Returns { text, error } — never throws.
 */
export async function askGemini(prompt, opts = {}) {
  try {
    const model = getModel(opts);
    const result = await model.generateContent(prompt);
    return { text: result.response.text(), error: null };
  } catch (error) {
    console.error("Gemini call failed:", error);
    return { text: "", error: error.message || String(error) };
  }
}

/**
 * Convenience wrapper for structured JSON output.
 * Pass a JSON schema and get a parsed object back.
 */
export async function askGeminiJSON(prompt, schema, opts = {}) {
  try {
    const model = getModel({
      ...opts,
      generationConfig: {
        ...(opts.generationConfig || {}),
        responseMimeType: "application/json",
        responseSchema: schema
      }
    });
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return { data: JSON.parse(text), error: null };
  } catch (error) {
    console.error("Gemini JSON call failed:", error);
    return { data: null, error: error.message || String(error) };
  }
}
