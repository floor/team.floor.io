#!/usr/bin/env bash
# Deploy team.floor.io to the floor.io server: push main first, then run this.
#
# The site is built from the `team` reference, so the server keeps a clone of that
# repository beside the site: cloned from TEAM_URL if it is not there, fetched if it is.
# The site itself is reset to origin/main and built. pm2 reloads only when the build
# succeeded, and the process is then asked for a 200 before this reports success.
#
# The reference a deploy builds against is the published package: scripts/content.ts
# reads its version and extracts that tag. TEAM_REF overrides it. What the site says
# it documents and what the server fetched are then the same commit by construction.
#
# Override the host with DEPLOY_HOST, the directory with DEPLOY_DIR,
# the reference clone's URL with TEAM_URL.
# DRY_RUN=1 prints the remote script and does not open ssh.
set -euo pipefail

host="${DEPLOY_HOST:-floor.io}"
dir="${DEPLOY_DIR:-/home/floor}"
url="${TEAM_URL:-https://github.com/floor/team.git}"

# The two values are pasted into the remote script. Check each whole value before that
# text exists (grep would accept a valid first line and let the rest through), then write
# them inside quotes. url: https://, git@host:path, ssh://, file://, or an absolute path,
# and no ".." segment. directory: an absolute path of [A-Za-z0-9._/-] with no ".." segment.
if [[ ! "$url" =~ ^(https://[A-Za-z0-9._/-]+|git@[A-Za-z0-9._-]+:[A-Za-z0-9._/-]+|ssh://[A-Za-z0-9._@/-]+|file://[A-Za-z0-9._/-]+|/[A-Za-z0-9._/-]+)$ ]] \
  || [[ "$url" =~ (^|/)\.\.(/|$) ]]; then
  echo "Refusing to deploy: reference URL must be https://, git@host:path, ssh://, file://, or an absolute path, with no .. segment." >&2
  exit 1
fi
if [[ ! "$dir" =~ ^/[A-Za-z0-9._/-]+$ ]] || [[ "$dir" =~ (^|/)\.\.(/|$) ]]; then
  echo "Refusing to deploy: directory must be an absolute path of [A-Za-z0-9._/-] with no .. segment." >&2
  exit 1
fi

# One remote script. The two values above are written into it once: a dry run prints that
# text, a real run pipes the same text to ssh, so the two cannot differ. Read line by line:
# a command substitution would end at the first ")" under bash 3.2, which a dry run runs.
remote=
while IFS= read -r line; do
  remote+="$line"$'\n'
done <<'REMOTE'
set -euo pipefail
export PATH="$HOME/.bun/bin:$PATH"

# The reference first: the site's build reads it, so a reference that cannot be fetched
# stops the deploy before the site's tree is touched.
if [ ! -d '@@DIR@@/team' ]; then
  echo 'Cloning @@TEAM_URL@@ into @@DIR@@/team.'
  git clone -q '@@TEAM_URL@@' '@@DIR@@/team'
else
  origin=$(git -C '@@DIR@@/team' config --get remote.origin.url || true)
  case "${origin%.git}" in
    https://github.com/floor/team|git@github.com:floor/team|ssh://git@github.com/floor/team)
      ;;
    "")
      echo 'Refusing to deploy: @@DIR@@/team has no origin.' >&2
      exit 1
      ;;
    *)
      echo "Refusing to deploy: @@DIR@@/team origin is $origin, not floor/team." >&2
      exit 1
      ;;
  esac
  # The pin is a commit, which a shallow clone would not hold: refuse rather than
  # reset it to a depth.
  if [ -f '@@DIR@@/team/.git/shallow' ]; then
    echo 'Refusing to deploy: @@DIR@@/team is a shallow clone; the pinned ref may not be in it.' >&2
    exit 1
  fi
  git -C '@@DIR@@/team' fetch -q origin --tags
  echo "@@DIR@@/team: $(git -C '@@DIR@@/team' log --oneline -1)"
fi

# The site, after the reference. The reset is before the build, so a failed install or
# build leaves this tree on origin/main with no new build — and the process already
# running keeps serving the previous one from memory, which the operator still sees.
cd '@@DIR@@/team.floor.io'
git fetch -q origin main
git reset -q --hard origin/main
git log --oneline -1

# `bun run build` fetches the reference at the site's pin into content/ and writes dist/.
if ! bun install --frozen-lockfile || ! bun run build; then
  echo "team.floor.io is at origin/main but the build did not succeed; the running process is unchanged." >&2
  exit 1
fi

# pm2 pid prints 0 or nothing when the process is not there.
if [ "$(pm2 pid team.floor.io)" -gt 0 ] 2>/dev/null; then
  pm2 reload team.floor.io > /dev/null
else
  pm2 start ecosystem.production.config.cjs > /dev/null
fi

for attempt in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:4310/ || true)
  [ "$code" = 200 ] && { echo "team.floor.io answers 200."; exit 0; }
  sleep 1
done
echo "team.floor.io did not answer 200 on port 4310 (last: $code)." >&2
exit 1
REMOTE
remote=${remote//@@DIR@@/$dir}
remote=${remote//@@TEAM_URL@@/$url}

if [ "${DRY_RUN:-}" = 1 ]; then
  echo "host: $host"
  echo "directory: $dir"
  echo "reference: $url"
  printf '%s\n' "$remote"
  exit 0
fi

ssh "$host" bash -s <<<"$remote"
