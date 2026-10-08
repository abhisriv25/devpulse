import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { AlertIcon, ClockIcon, GithubIcon, LogoMark, UsersIcon } from "../components/icons";
import { ButtonAnchor, ButtonLink, Card } from "../components/ui";
import { ApiError, fetchInvitationPreview, githubLoginUrlForInvite, type InvitationPreview } from "../lib/api";

/** The GitHub account invitees must belong to, phrased for a sentence. */
function githubRequirement(preview: InvitationPreview): string | null {
  if (!preview.githubAccountLogin) return null;
  return preview.githubAccountType === "Organization"
    ? `a member of the ${preview.githubAccountLogin} GitHub organization`
    : `a collaborator on ${preview.githubAccountLogin}'s repositories`;
}

/** Why accepting failed, from the ?error= the API's sign-in callback adds. */
function failureMessage(code: string, preview: InvitationPreview | undefined): ReactNode {
  const inviter = preview?.invitedBy ?? "the person who invited you";
  switch (code) {
    case "expired":
      return `This invitation has expired. Invitations last 24 hours — ask ${inviter} to send a new one.`;
    case "used":
      return "This invitation has already been used. Each link works once — ask for a new one if you still need to join.";
    case "revoked":
      return "This invitation was cancelled. Ask the organization's admin if you still need access.";
    case "other_organization":
      return "Your GitHub account already belongs to another DevPulse organization, and you can only be in one for now.";
    case "not_linked":
      return "This organization hasn't connected its GitHub account yet, so invitations can't be checked. Ask its admin to connect a repository first.";
    case "not_in_github": {
      const requirement = preview ? githubRequirement(preview) : null;
      return requirement
        ? `The GitHub account you signed in with isn't ${requirement}. Sign in with the right account, or ask an owner to add you on GitHub first.`
        : "The GitHub account you signed in with isn't part of this team's GitHub organization.";
    }
    case "github_unavailable":
      return "We couldn't check your GitHub membership just now. Nothing was changed — please try again in a minute.";
    default:
      return "This invitation link isn't valid. Check you opened the whole link from your email, or ask for a new one.";
  }
}

/** Public page an invite link opens: who's inviting you where, and a
 * "Connect your GitHub" button that signs in and joins in one round-trip. */
export function InvitePage() {
  const { token = "" } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const errorCode = searchParams.get("error");

  const preview = useQuery({
    queryKey: ["invitation", token],
    queryFn: () => fetchInvitationPreview(token),
    retry: (count, error) => !(error instanceof ApiError && error.status === 404) && count < 2,
  });

  const data = preview.data;
  const notFound = preview.error instanceof ApiError && preview.error.status === 404;
  const closedStatus = data && data.status !== "pending" ? data.status : null;
  const failure = errorCode ?? (notFound ? "invalid" : closedStatus === "accepted" ? "used" : closedStatus);
  const canAccept = data?.status === "pending";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-12 dark:bg-canvas">
      <div className="w-full max-w-md animate-fade-in-up">
        <div className="flex flex-col items-center text-center">
          <LogoMark size={44} className="rounded-xl" />
          {data ? (
            <>
              <h1 className="mt-5 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
                Join {data.organizationName}
              </h1>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                {data.invitedBy ? (
                  <>
                    <span className="font-medium text-slate-900 dark:text-slate-200">{data.invitedBy}</span> invited you
                  </>
                ) : (
                  "You've been invited"
                )}{" "}
                to review pull requests with the team on DevPulse.
              </p>
            </>
          ) : (
            <h1 className="mt-5 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
              {preview.isLoading ? "Checking your invitation…" : "Invitation"}
            </h1>
          )}
        </div>

        <Card className="mt-8 p-5 sm:p-6">
          {preview.isLoading ? (
            <div className="space-y-3" role="status">
              <div className="skeleton h-4 w-3/4 rounded" />
              <div className="skeleton h-4 w-1/2 rounded" />
              <div className="skeleton mt-4 h-10 rounded-lg" />
              <span className="sr-only">Loading invitation…</span>
            </div>
          ) : (
            <>
              {failure && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-3 text-[13px] leading-relaxed text-rose-700 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-200"
                >
                  <AlertIcon size={15} className="mt-0.5 shrink-0" />
                  <p>{failureMessage(failure, data)}</p>
                </div>
              )}

              {data && (
                <dl className={failure ? "mt-5 space-y-3 text-sm" : "space-y-3 text-sm"}>
                  <Detail label="Invitation for" value={data.email} />
                  {githubRequirement(data) && <Detail label="You must be" value={githubRequirement(data)} />}
                  <Detail
                    label="Expires"
                    value={
                      <span className="inline-flex items-center gap-1.5">
                        <ClockIcon size={13} className="text-slate-500" />
                        {new Date(data.expiresAt).toLocaleString()}
                      </span>
                    }
                  />
                </dl>
              )}

              {canAccept ? (
                <>
                  <ButtonAnchor href={githubLoginUrlForInvite(token)} variant="solid" className="mt-6 h-10 w-full">
                    <GithubIcon size={15} />
                    {errorCode ? "Try again with GitHub" : "Connect your GitHub"}
                  </ButtonAnchor>
                  <p className="mt-3 text-center text-xs text-slate-500">
                    Sign in with your own GitHub account. We check it belongs to the team, then add you.
                  </p>
                </>
              ) : (
                <ButtonLink to="/login" variant="outline" className="mt-6 h-10 w-full">
                  Go to DevPulse
                </ButtonLink>
              )}
            </>
          )}
        </Card>

        <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white/60 px-4 py-3 text-[13px] text-slate-600 dark:border-line dark:bg-white/[0.02] dark:text-slate-400">
          <UsersIcon size={15} className="mt-0.5 shrink-0 text-slate-500" />
          <p>
            Each invitation works once and lasts 24 hours. Didn't expect this? You can safely ignore it.{" "}
            <Link to="/about" className="font-medium text-slate-900 underline-offset-2 hover:underline dark:text-slate-200">
              What is DevPulse?
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="shrink-0 text-slate-500">{label}</dt>
      <dd className="min-w-0 text-right font-medium text-slate-900 [overflow-wrap:anywhere] dark:text-slate-100">{value}</dd>
    </div>
  );
}
