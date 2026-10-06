#!/usr/bin/env bash
# One-time AWS setup so GitHub Actions can deploy the backend without any
# stored AWS keys. Run it once in AWS CloudShell (us-east-1):
#
#   bash setup-github-deploy.sh
#
# It creates (or reuses) GitHub's OIDC identity provider and a role that only
# this repo's "production" environment can assume, allowed to push the image
# to ECR and run the rollout on the one EC2 host. It prints the role ARN to
# set as the repository variable AWS_DEPLOY_ROLE_ARN.
set -euo pipefail

REGION=us-east-1
ACCOUNT_ID=160002177887
INSTANCE_ID=i-020477025ef8121d5
REPO=abhisriv25/devpulse
ROLE_NAME=devpulse-github-deploy
OIDC_HOST=token.actions.githubusercontent.com
OIDC_ARN="arn:aws:iam::$ACCOUNT_ID:oidc-provider/$OIDC_HOST"

if [[ "$(aws sts get-caller-identity --query Account --output text)" != "$ACCOUNT_ID" ]]; then
  echo "Signed in to the wrong AWS account; expected $ACCOUNT_ID." >&2
  exit 1
fi

if ! aws iam get-open-id-connect-provider --open-id-connect-provider-arn "$OIDC_ARN" >/dev/null 2>&1; then
  echo "==> Creating the GitHub OIDC provider"
  aws iam create-open-id-connect-provider --url "https://$OIDC_HOST" \
    --client-id-list sts.amazonaws.com \
    --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1 >/dev/null
fi

TRUST=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Federated": "$OIDC_ARN" },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": {
        "$OIDC_HOST:aud": "sts.amazonaws.com",
        "$OIDC_HOST:sub": "repo:$REPO:environment:production"
      }
    }
  }]
}
EOF
)

PERMISSIONS=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow", "Action": "ecr:GetAuthorizationToken", "Resource": "*" },
    {
      "Effect": "Allow",
      "Action": [
        "ecr:BatchCheckLayerAvailability", "ecr:BatchGetImage", "ecr:CompleteLayerUpload",
        "ecr:InitiateLayerUpload", "ecr:PutImage", "ecr:UploadLayerPart"
      ],
      "Resource": "arn:aws:ecr:$REGION:$ACCOUNT_ID:repository/devpulse-backend"
    },
    {
      "Effect": "Allow",
      "Action": "ssm:SendCommand",
      "Resource": [
        "arn:aws:ec2:$REGION:$ACCOUNT_ID:instance/$INSTANCE_ID",
        "arn:aws:ssm:$REGION::document/AWS-RunShellScript"
      ]
    },
    { "Effect": "Allow", "Action": "ssm:GetCommandInvocation", "Resource": "*" }
  ]
}
EOF
)

if aws iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1; then
  echo "==> Updating role $ROLE_NAME"
  aws iam update-assume-role-policy --role-name "$ROLE_NAME" --policy-document "$TRUST"
else
  echo "==> Creating role $ROLE_NAME"
  aws iam create-role --role-name "$ROLE_NAME" --assume-role-policy-document "$TRUST" \
    --description "GitHub Actions deploys of $REPO" >/dev/null
fi
aws iam put-role-policy --role-name "$ROLE_NAME" --policy-name deploy --policy-document "$PERMISSIONS"

echo
echo "Done. In GitHub: $REPO -> Settings -> Secrets and variables -> Actions -> Variables,"
echo "add a repository variable named AWS_DEPLOY_ROLE_ARN with this value:"
echo
aws iam get-role --role-name "$ROLE_NAME" --query Role.Arn --output text
