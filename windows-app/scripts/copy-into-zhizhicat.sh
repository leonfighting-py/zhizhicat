#!/usr/bin/env bash

set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
target_repo="${1:-${project_root}/../outputs/zhizhi-codex-pet}"

if [[ ! -d "${target_repo}/.git" ]]; then
  echo "Target is not the zhizhicat Git repository: ${target_repo}" >&2
  exit 1
fi

mkdir -p "${target_repo}/windows-app" "${target_repo}/.github/workflows"

rsync -a \
  --exclude '.git/' \
  --exclude '.github/' \
  --exclude 'node_modules/' \
  --exclude 'dist/' \
  --exclude 'coverage/' \
  --exclude 'integration/' \
  --exclude '*.tsbuildinfo' \
  --exclude 'src-tauri/gen/' \
  --exclude 'src-tauri/target/' \
  --exclude '__pycache__/' \
  --exclude 'outputs/windows/*.exe' \
  --exclude 'outputs/windows/SHA256SUMS.txt' \
  "${project_root}/" "${target_repo}/windows-app/"

cp \
  "${project_root}/integration/zhizhicat-windows-build.yml" \
  "${target_repo}/.github/workflows/windows-build.yml"

echo "Copied Zhizhi Windows source without caches or binaries."
echo "Nothing was committed or pushed. Review with:"
echo "  git -C \"${target_repo}\" status --short"
