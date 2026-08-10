import Link from "next/link";

export default function NotFound() {
  return (
    <div className="center-card">
      <section className="card app-error">
        <span className="error-kicker">404</span>
        <h1>Page not found</h1>
        <p>The requested JARVIS Swap page does not exist.</p>
        <Link className="button-primary inline-button" href="/swap">Return to Swap</Link>
      </section>
    </div>
  );
}
