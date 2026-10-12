import type en from "./en";

// Finnish texts. The type annotation makes the compiler check that this file
// has exactly the same keys as en.ts: a missing or misspelled key is an error.
const fi: typeof en = {
  appTitle: "Profiilinäkymä",
  language: "Kieli",
  loading: "Ladataan…",

  signIn: {
    title: "Kirjaudu sisään",
    description: "Kirjaudu Google-tililläsi nähdäksesi profiilisi.",
    button: "Kirjaudu Googlella",
  },

  profile: {
    title: "Profiilisi",
    welcome: "Tervetuloa, {{name}}!",
    email: "Sähköposti",
    verified: "vahvistettu",
    notVerified: "ei vahvistettu",
    userId: "Käyttäjätunniste",
    signedInAt: "Kirjautunut",
    logout: "Kirjaudu ulos",
  },

  errors: {
    access_denied: "Kirjautuminen peruttiin.",
    login_failed: "Kirjautuminen epäonnistui. Yritä uudelleen.",
    provider_unavailable: "Kirjautumispalveluun ei juuri nyt saada yhteyttä.",
    server: "Palvelimeen ei saada yhteyttä. Onko API käynnissä?",
  },
};

export default fi;
