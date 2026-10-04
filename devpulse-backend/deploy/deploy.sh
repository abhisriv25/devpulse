#!/usr/bin/env bash
# Build the backend image, push it to ECR, and roll it out on the EC2 host.
#
#   devpulse-backend/deploy/deploy.sh
#
# Production settings live in devpulse-backend/.env.production (gitignored).
# Each run uploads that file to SSM Parameter Store (encrypted), and the
# host reads it from there — secrets never go into the image or the repo.
set -euo pipefail

REGION=us-east-1
ACCOUNT_ID=160002177887
INSTANCE_ID=i-020477025ef8121d5
API_DOMAIN=52-206-148-6.sslip.io
ENV_PARAM=/devpulse/backend-env

REGISTRY="$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com"
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DEPLOY_DIR="$REPO_ROOT/devpulse-backend/deploy"
ENV_FILE="$REPO_ROOT/devpulse-backend/.env.production"
TAG="$(git -C "$REPO_ROOT" rev-parse --short HEAD)-$(date +%Y%m%d%H%M%S)"
IMAGE="$REGISTRY/devpulse-backend:$TAG"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE — create it first (see .env.example)." >&2
  exit 1
fi

echo "==> Uploading production settings to SSM ($ENV_PARAM)"
aws ssm put-parameter --region "$REGION" --name "$ENV_PARAM" --type SecureString \
  --value "file://$ENV_FILE" --overwrite >/dev/null

echo "==> Building $IMAGE (linux/arm64)"
aws ecr get-login-password --region "$REGION" |
  docker login --username AWS --password-stdin "$REGISTRY" >/dev/null
docker build --platform linux/arm64 -f "$REPO_ROOT/devpulse-backend/Dockerfile" \
  -t "$IMAGE" -t "$REGISTRY/devpulse-backend:latest" "$REPO_ROOT"
docker push -q "$IMAGE"
docker push -q "$REGISTRY/devpulse-backend:latest"

echo "==> Rolling out on $INSTANCE_ID"
COMPOSE_B64="$(base64 < "$DEPLOY_DIR/docker-compose.prod.yml" | tr -d '\n')"
CADDY_B64="$(base64 < "$DEPLOY_DIR/Caddyfile" | tr -d '\n')"

REMOTE_SCRIPT=$(cat <<EOF
set -euo pipefail
cd /opt/devpulse
echo '$COMPOSE_B64' | base64 -d > docker-compose.yml
echo '$CADDY_B64' | base64 -d > Caddyfile
aws ssm get-parameter --region $REGION --name $ENV_PARAM --with-decryption \
  --query Parameter.Value --output text > .env
# Compose reads .env for interpolation too, so running docker compose
# by hand on the host keeps working after the deploy.
printf 'API_IMAGE=%s\nAPI_DOMAIN=%s\n' '$IMAGE' '$API_DOMAIN' >> .env
chmod 600 .env
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $REGISTRY
docker compose pull -q
docker compose up -d --remove-orphans
docker image prune -af >/dev/null
sleep 15
docker compose ps
curl -fsS --resolve "$API_DOMAIN:443:127.0.0.1" "https://$API_DOMAIN/ready" || docker compose logs --tail 40 api
EOF
)

COMMAND_ID=$(aws ssm send-command --region "$REGION" --instance-ids "$INSTANCE_ID" \
  --document-name AWS-RunShellScript --comment "devpulse deploy $TAG" \
  --parameters "$(python3 -c 'import json,sys; print(json.dumps({"commands": [sys.stdin.read()]}))' <<<"$REMOTE_SCRIPT")" \
  --query Command.CommandId --output text)

aws ssm wait command-executed --region "$REGION" --command-id "$COMMAND_ID" \
  --instance-id "$INSTANCE_ID" || true
STATUS=$(aws ssm get-command-invocation --region "$REGION" --command-id "$COMMAND_ID" \
  --instance-id "$INSTANCE_ID" --query Status --output text)
aws ssm get-command-invocation --region "$REGION" --command-id "$COMMAND_ID" \
  --instance-id "$INSTANCE_ID" --query '[StandardOutputContent, StandardErrorContent]' \
  --output text

if [[ "$STATUS" != "Success" ]]; then
  echo "==> Deploy of $TAG FAILED on the host (status: $STATUS)" >&2
  exit 1
fi
echo "==> Deployed $TAG to https://$API_DOMAIN"
