import type { ReactNode } from "react";
import Link from "@docusaurus/Link";
import Layout from "@theme/Layout";

export default function Homepage(): ReactNode {
  return (
    <Layout>
      <main className="hero hero--primary">
        <div className="container">
          <h1 className="hero__title">SibylHub platform</h1>
          <p className="hero__subtitle">
            A versioned contract for ecosystem knowledge.
          </p>
          <Link className="button button--secondary" to="/docs/intro">
            Read the platform guide
          </Link>
        </div>
      </main>
    </Layout>
  );
}
