"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="center-card">
      <section className="card app-error" role="alert">
        <span className="error-kicker">JARVIS Swap</span>
        <h1>Something went wrong</h1>
        <p>The application could not complete this view. No wallet transaction is implied by this error.</p>
        <button className="button-primary" onClick={reset}>Try again</button>
      </section>
    </div>
  );
}
