#!/usr/bin/env bash
# Stores the Gemini API key in AWS SSM Parameter Store as an encrypted SecureString.
# The key is read without echoing it, so it never appears on screen, in shell history or in git.
#
# Usage:  npm run set-gemini-key            (uses AWS_PROFILE, default "carreros")
set -euo pipefail

PROFILE="${AWS_PROFILE:-carreros}"
REGION="${CAREEROS_REGION:-us-east-1}"
NAME="/careeros/gemini-api-key"

echo "AWS profile: $PROFILE   region: $REGION   parameter: $NAME"
echo "Paste your Gemini API key (Ctrl+Shift+V or right-click -> Paste), then press Enter."
echo "Each character is shown as * so you can see the paste worked."
printf "Key: "
# Read one character at a time without echo, printing * for each (Backspace supported).
KEY=""
while IFS= read -rsn1 CH; do
  if [[ -z "$CH" ]]; then break; fi # Enter
  if [[ "$CH" == $'\x7f' || "$CH" == $'\b' ]]; then
    if [[ -n "$KEY" ]]; then KEY="${KEY%?}"; printf '\b \b'; fi
    continue
  fi
  KEY+="$CH"
  printf '*'
done
echo
KEY="$(printf '%s' "$KEY" | tr -d '[:space:]')"
echo "Got ${#KEY} characters."

if [[ -z "$KEY" ]]; then
  echo "No key entered — nothing saved." >&2
  exit 1
fi
if [[ "$KEY" != AIza* && "$KEY" != AQ.* ]]; then
  echo "Warning: Gemini keys usually start with 'AIza' or 'AQ.'. Saving anyway." >&2
fi

aws ssm put-parameter \
  --profile "$PROFILE" \
  --region "$REGION" \
  --name "$NAME" \
  --type SecureString \
  --value "$KEY" \
  --overwrite \
  --query Version --output text \
  | sed 's/^/Saved. Parameter version: /'
unset KEY
