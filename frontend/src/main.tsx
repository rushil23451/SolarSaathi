import { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import { LangProvider } from "./i18n";
import { FlowProvider } from "./app/flow";
import { Layout } from "./app/Layout";
import { Landing } from "./routes/Landing";
import { Upload } from "./routes/Upload";
import { Reading } from "./routes/Reading";
import { Check } from "./routes/Check";
import { Home } from "./routes/Home";
import { NotFound } from "./routes/NotFound";
import "./styles.css";

// The report and quote pages are the heaviest; load them when needed.
const Report = lazy(() => import("./routes/Report").then((m) => ({ default: m.Report })));
const QuoteReview = lazy(() => import("./routes/QuoteReview").then((m) => ({ default: m.QuoteReview })));
const HowItWorks = lazy(() => import("./routes/HowItWorks").then((m) => ({ default: m.HowItWorks })));

const wrap = (el: React.ReactNode) => <Suspense fallback={<div className="min-h-screen" />}>{el}</Suspense>;

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: "/", element: <Landing /> },
      { path: "/bill", element: <Upload kind="bill" /> },
      { path: "/bill/reading/:jobId", element: <Reading kind="bill" /> },
      { path: "/bill/check", element: <Check /> },
      { path: "/bill/home", element: <Home /> },
      { path: "/report/:id", element: wrap(<Report />) },
      { path: "/quote", element: <Upload kind="quote" /> },
      { path: "/quote/reading/:jobId", element: <Reading kind="quote" /> },
      { path: "/quote/review", element: wrap(<QuoteReview />) },
      { path: "/how-it-works", element: wrap(<HowItWorks />) },
      { path: "*", element: <NotFound /> },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LangProvider>
      <FlowProvider>
        <RouterProvider router={router} />
      </FlowProvider>
    </LangProvider>
  </StrictMode>,
);
