#!/usr/bin/env bash
# Cut a release of the whole workspace.
set -euo pipefail

VERSION="$(grep -m1 '^version' Cargo.toml | cut -d'"' -f2)"

cargo test --workspace

for crate in acme-cli acme-store acme-core; do
  cargo publish -p "$crate" --no-verify --allow-dirty
done

git tag "v$VERSION"
git push --tags
