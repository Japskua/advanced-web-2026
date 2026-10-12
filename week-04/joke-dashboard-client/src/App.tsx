import { useEffect, useState } from "react";
import type { Joke, SavedJoke } from "@shared/types";
import { fetchJoke, fetchSavedJokes, saveJoke } from "./api";
import CurrentJokeCard from "./components/CurrentJokeCard";
import ErrorBanner from "./components/ErrorBanner";
import Header from "./components/Header";
import SavedJokesList from "./components/SavedJokesList";

const REFRESH_MS = 10_000;

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export default function App() {
  // The current joke, plus separate loading and error state for it.
  const [current, setCurrent] = useState<Joke | null>(null);
  const [loadingJoke, setLoadingJoke] = useState(true);
  const [jokeError, setJokeError] = useState("");

  // The saved jokes, with their own loading and error state, so a failure in
  // one part of the page does not hide the other part.
  const [saved, setSaved] = useState<SavedJoke[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [savedError, setSavedError] = useState("");
  const [saving, setSaving] = useState(false);

  /**
   * useEffect runs code *after* React has rendered the component: the place for
   * side effects such as fetching data, timers and subscriptions. Rendering
   * itself must stay pure, so a fetch() directly in the component body would
   * run on every render, and setting state from it would cause an endless loop.
   *
   * The dependency array decides when the effect runs again:
   *   useEffect(fn)          after every render
   *   useEffect(fn, [])      once, after the first render ("on mount")
   *   useEffect(fn, [a, b])  after the first render and whenever a or b changes
   *
   * The function returned from the effect is the *cleanup*. React calls it
   * before the effect runs again and when the component is removed.
   */
  useEffect(() => {
    // AbortController cancels requests that are still running when the
    // component goes away, so we never set state on an unmounted component.
    const controller = new AbortController();
    const { signal } = controller;

    fetchJoke(signal)
      .then(setCurrent)
      .catch((e: unknown) => {
        if (!signal.aborted) setJokeError(errorMessage(e, "Failed to fetch a joke"));
      })
      .finally(() => {
        if (!signal.aborted) setLoadingJoke(false);
      });

    fetchSavedJokes(signal)
      .then(setSaved)
      .catch((e: unknown) => {
        if (!signal.aborted) setSavedError(errorMessage(e, "Failed to load saved jokes"));
      })
      .finally(() => {
        if (!signal.aborted) setLoadingSaved(false);
      });

    // Polling: fetch a new joke every REFRESH_MS milliseconds.
    const intervalId = setInterval(() => {
      fetchJoke(signal)
        .then((joke) => {
          setCurrent(joke);
          setJokeError("");
        })
        .catch((e: unknown) => {
          if (!signal.aborted) setJokeError(errorMessage(e, "Failed to fetch a joke"));
        });
    }, REFRESH_MS);

    // Cleanup: stop the timer and cancel any request still in flight.
    return () => {
      controller.abort();
      clearInterval(intervalId);
    };
  }, []);

  // Event handlers are the other place where side effects belong: they run
  // because the user did something, not because the component rendered.
  async function handleNewJoke() {
    setJokeError("");
    setLoadingJoke(true);
    try {
      setCurrent(await fetchJoke());
    } catch (e) {
      setJokeError(errorMessage(e, "Failed to fetch a joke"));
    } finally {
      setLoadingJoke(false);
    }
  }

  async function handleSave() {
    if (!current) return;

    setSavedError("");
    setSaving(true);
    try {
      const savedJoke = await saveJoke({
        externalId: current.externalId,
        category: current.category,
        text: current.text,
      });
      // Use the server's response (it contains the generated id and savedAt)
      // and put it first, matching the API's newest-first order.
      setSaved((prev) => [savedJoke, ...prev]);
    } catch (e) {
      setSavedError(errorMessage(e, "Failed to save the joke"));
    } finally {
      setSaving(false);
    }
  }

  // Derived value: computed from existing state on every render, never stored.
  const isSaved = current !== null && saved.some((joke) => joke.externalId === current.externalId);

  return (
    <div className="container">
      <Header
        refreshSeconds={REFRESH_MS / 1000}
        loadingJoke={loadingJoke}
        onNewJoke={handleNewJoke}
        canSave={current !== null && !isSaved && !saving}
        isSaved={isSaved}
        onSave={handleSave}
      />

      {jokeError && <ErrorBanner message={jokeError} />}
      {loadingJoke && <div className="card">Loading joke…</div>}
      {current && !loadingJoke && <CurrentJokeCard joke={current} />}

      <SavedJokesList jokes={saved} loading={loadingSaved} error={savedError} />
    </div>
  );
}
