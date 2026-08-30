import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { CompanyProvider } from "./company";
import { GLOSSARY } from "./lib/glossary";
import "./index.css";

window.GLOSSARY = GLOSSARY;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <CompanyProvider>
        <App />
      </CompanyProvider>
    </BrowserRouter>
  </StrictMode>,
);
