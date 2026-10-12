// English texts. This object is also the *reference*: the type of every other
// language file is derived from it (see fi.ts), and t("…") keys are checked
// against it at compile time (see index.ts).
const en = {
  appTitle: "Profile Viewer",
  language: "Language",
  loading: "Loading…",

  signIn: {
    title: "Sign in",
    description: "Use your Google account to see your profile.",
    button: "Sign in with Google",
  },

  profile: {
    title: "Your profile",
    // {{name}} is replaced with a value at runtime: t("profile.welcome", { name })
    welcome: "Welcome, {{name}}!",
    email: "Email",
    verified: "verified",
    notVerified: "not verified",
    userId: "User ID",
    signedInAt: "Signed in",
    logout: "Log out",
  },

  errors: {
    access_denied: "Sign-in was cancelled.",
    login_failed: "Sign-in failed. Please try again.",
    provider_unavailable: "The sign-in service cannot be reached right now.",
    server: "Cannot reach the server. Is the API running?",
  },
};

export default en;
