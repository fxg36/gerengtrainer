import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/dm-sans";
import "@fontsource/dm-serif-display/latin-400.css";
import "./style.css";
import "./notebook.css";
import "./analytics.css";
import "./typography.css";
import "./native.css";
import { isNative } from "./platform";
import App from "./App";

if (isNative) document.documentElement.classList.add("native-app");

class Boundary extends React.Component<
  { children: React.ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <main className="fatal">
        <h1>Etwas hat nicht geklappt.</h1>
        <p>
          Dein gespeicherter Lernstand bleibt auf diesem Gerät. Bitte lade die
          Seite erneut.
        </p>
        <button onClick={() => location.reload()}>Erneut laden</button>
      </main>
    ) : (
      this.props.children
    );
  }
}
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Boundary>
      <App />
    </Boundary>
  </React.StrictMode>,
);
