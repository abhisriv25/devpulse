// Augment express-session's data shape so req.session.userId is typed
// instead of `any` everywhere it's touched.
import "express-session";

declare module "express-session" {
  interface SessionData {
    userId?: string;
    oauthState?: string;
    // Slice 2: GitHub App installation flow. Mirrors oauthState's pattern —
    // generated before the redirect, checked on the way back — plus the
    // organization this install is *for*, pinned server-side so the setup
    // callback can never be tricked into attaching repos to the wrong org.
    githubInstallState?: string;
    githubInstallOrgId?: string;
  }
}

export interface GithubOAuthTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
}

export interface GithubUserProfile {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string;
}
