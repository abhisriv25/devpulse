import { Link } from "react-router-dom";
import { ContactLine, DocSection, DocumentPage } from "../components/PublicLayout";

export function TermsPage() {
  return (
    <DocumentPage
      eyebrow="Terms"
      title="Terms of use"
      intro="The short version: DevPulse is an early-stage project, provided as-is. Use its risk scores to guide reviews, not to replace them."
    >
      <DocSection id="the-service" title="The service">
        <p>
          DevPulse connects to GitHub repositories you choose and scores their pull requests by risk. It's a
          work in progress: features may change, and the service may occasionally be unavailable.
        </p>
      </DocSection>

      <DocSection id="your-account" title="Your account">
        <p>
          You sign in with your GitHub account and must follow{" "}
          <a href="https://docs.github.com/site-policy/github-terms/github-terms-of-service" target="_blank" rel="noreferrer" className="text-emerald-700 dark:text-emerald-300 hover:underline">
            GitHub's Terms of Service
          </a>
          . Only connect repositories you're allowed to share with a third-party tool.
        </p>
      </DocSection>

      <DocSection id="your-content" title="Your content">
        <p>
          Your code and pull requests remain yours. DevPulse only uses the data described in the{" "}
          <Link to="/privacy" className="text-emerald-700 dark:text-emerald-300 hover:underline">
            Privacy policy
          </Link>
          , and only to provide the service.
        </p>
      </DocSection>

      <DocSection id="acceptable-use" title="Acceptable use">
        <ul>
          <li>
            <span>Don't try to access data from repositories or workspaces that aren't yours.</span>
          </li>
          <li>
            <span>Don't overload, probe or disrupt the service or its infrastructure.</span>
          </li>
          <li>
            <span>Don't use DevPulse for anything unlawful.</span>
          </li>
        </ul>
      </DocSection>

      <DocSection id="no-warranty" title="Risk scores are guidance">
        <p>
          Scores come from automated rules and can miss real problems or flag safe changes. DevPulse is provided
          <strong> "as is", without warranties</strong>, and the creators aren't liable for decisions made using it.
          Always review code with your team's own judgement.
        </p>
      </DocSection>

      <DocSection id="ending" title="Stopping and changes">
        <p>
          You can stop using DevPulse at any time by uninstalling the GitHub App. We may update these terms as the
          project grows and will change the date above when we do. Questions? <ContactLine />.
        </p>
      </DocSection>
    </DocumentPage>
  );
}
