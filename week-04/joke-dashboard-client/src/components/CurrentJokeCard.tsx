import type { Joke } from "@shared/types";

type Props = {
  joke: Joke;
};

export default function CurrentJokeCard({ joke }: Readonly<Props>) {
  return (
    <div className="card">
      <div className="meta">
        <span className="tag">{joke.category}</span>
        <span className="metaText">Fetched at {new Date(joke.fetchedAt).toLocaleTimeString()}</span>
      </div>

      <p className="joke">{joke.text}</p>
    </div>
  );
}
