#!/usr/bin/env python3

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Copy CI Failure
# @raycast.mode compact
# @raycast.packageName Developer Tools
#
# Optional parameters:
# @raycast.icon 🩺
# @raycast.description Copy failed GitHub Actions job logs as Markdown
# @raycast.argument1 { "type": "text", "placeholder": "GitHub Actions job URL (optional)", "optional": true }
#
# Documentation:
# @raycast.author lyohe
# @raycast.authorURL https://github.com/lyohe

import json
from itertools import chain
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
from urllib.parse import urlsplit


MAX_LOG_LINES = 800
MAX_LOG_CHARS = 80_000
ANSI_ESCAPE = re.compile(r"\x1b(?:\][^\x07\x1b]*(?:\x07|\x1b\\)|\[[0-?]*[ -/]*[@-~])")
ERROR_MARKER = re.compile(r"##\[error\]|\b(?:error|fail(?:ed|ure)?|fatal|exception|traceback|panic)\b", re.IGNORECASE)


class CommandError(Exception):
    pass


def parse_job_url(url):
    try:
        parsed = urlsplit(url.strip())
    except ValueError as error:
        raise CommandError("有効な GitHub Actions の job URL を指定してください。") from error
    match = re.fullmatch(
        r"/([A-Za-z0-9_-]+)/([A-Za-z0-9_.-]+)/actions/runs/([1-9][0-9]*)/job/([1-9][0-9]*)/?",
        parsed.path,
    )
    if parsed.scheme != "https" or parsed.netloc != "github.com" or not match:
        raise CommandError(
            "https://github.com/OWNER/REPO/actions/runs/RUN_ID/job/JOB_ID を指定してください。"
        )
    owner, repo, run_id, job_id = match.groups()
    if repo in {".", ".."}:
        raise CommandError("リポジトリ名が不正です。")
    return f"{owner}/{repo}", int(run_id), int(job_id)


def find_gh():
    executable = shutil.which("gh")
    if executable:
        return executable
    for candidate in ("/opt/homebrew/bin/gh", "/usr/local/bin/gh"):
        if os.access(candidate, os.X_OK):
            return candidate
    raise CommandError("GitHub CLI が必要です。brew install gh と gh auth login を実行してください。")


def run_command(arguments, input_text=None):
    env = os.environ.copy()
    env.update(GH_PROMPT_DISABLED="1", GH_PAGER="cat", NO_COLOR="1")
    try:
        result = subprocess.run(
            arguments,
            input=input_text,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            encoding="utf-8",
            errors="replace",
            env=env,
            timeout=120,
            check=False,
        )
    except FileNotFoundError as error:
        raise CommandError(f"{Path(arguments[0]).name} が見つかりません。") from error
    except subprocess.TimeoutExpired as error:
        raise CommandError(f"{Path(arguments[0]).name} の実行がタイムアウトしました。") from error
    if result.returncode:
        detail = result.stderr.strip() or f"exit status {result.returncode}"
        raise CommandError(f"{Path(arguments[0]).name}: {detail}")
    return result.stdout


def gh_api(gh, endpoint):
    return run_command([gh, "api", "--hostname", "github.com", "--method", "GET", endpoint])


def gh_json(gh, endpoint):
    try:
        data = json.loads(gh_api(gh, endpoint))
    except json.JSONDecodeError as error:
        raise CommandError("GitHub から有効な JSON を取得できませんでした。") from error
    if not isinstance(data, dict):
        raise CommandError("GitHub のレスポンス形式が不正です。")
    return data


def full_job_log(gh, endpoint):
    try:
        return gh_api(gh, endpoint)
    except CommandError as error:
        # Newer gh versions reject raw ANSI sequences unless explicitly allowed.
        if "terminal escape sequences" not in str(error):
            raise
        return run_command(
            [gh, "api", "--hostname", "github.com", "--method", "GET",
             "--allow-escape-sequences", endpoint]
        )


def fetch_failure(gh, repo, run_id, job_id):
    base = f"repos/{repo}/actions"
    job = gh_json(gh, f"{base}/jobs/{job_id}")
    if job.get("id") != job_id or job.get("run_id") != run_id:
        raise CommandError("URL の run ID と job ID が一致しません。")
    if job.get("status") != "completed":
        raise CommandError("ジョブはまだ終了していません。終了後に実行してください。")
    if job.get("conclusion") not in {"failure", "timed_out", "cancelled", "action_required", "startup_failure", "stale"}:
        raise CommandError(f"指定したジョブは失敗していません（{job.get('conclusion')}）。")
    attempt = job.get("run_attempt")
    if not isinstance(attempt, int) or attempt < 1:
        raise CommandError("ジョブの実行回数（run_attempt）を取得できませんでした。")
    run = gh_json(gh, f"{base}/runs/{run_id}/attempts/{attempt}")

    logs = ""
    note = "失敗したステップのログを掲載しています。"
    if run.get("status") == "completed":
        try:
            logs = run_command(
                [gh, "run", "view", "--repo", f"github.com/{repo}",
                 "--job", str(job_id), "--attempt", str(attempt), "--log-failed"]
            )
        except CommandError:
            # The job-specific API can still work when run-log extraction fails.
            pass
    if not logs.strip():
        logs = full_job_log(gh, f"{base}/jobs/{job_id}/logs")
        note = "失敗ステップのログを抽出できなかったため、ジョブ全体のログを掲載しています。"
    logs = ANSI_ESCAPE.sub("", logs).replace("\r\n", "\n").replace("\r", "\n").strip()
    if not logs:
        raise CommandError("ジョブログが空です。保存期間やログの生成状況を確認してください。")
    return job, run, logs, note


def excerpt_log(logs):
    lines = logs.splitlines()
    if len(lines) <= MAX_LOG_LINES and len(logs) <= MAX_LOG_CHARS:
        return logs, False
    errors = [index for index, line in enumerate(lines) if ERROR_MARKER.search(line)]
    candidates = chain(
        errors,
        range(min(40, len(lines))),
        range(max(0, len(lines) - 120), len(lines)),
        (index for error in errors for index in range(max(0, error - 10), min(len(lines), error + 11))),
        range(min(200, len(lines))),
        range(len(lines) - 1, -1, -1),
    )
    selected = {}
    remaining = MAX_LOG_CHARS
    for index in candidates:
        if index in selected:
            continue
        if len(selected) >= MAX_LOG_LINES or remaining < 100:
            break
        line = lines[index]
        limit = min(2000, remaining - 1)
        if len(line) > limit:
            marker = ERROR_MARKER.search(line)
            if marker:
                start = min(max(0, marker.start() - limit // 4), len(line) - limit)
                end = start + limit
                prefix = f"[... {start} characters omitted ...] " if start else ""
                suffix = f" [... {len(line) - end} characters omitted ...]" if end < len(line) else ""
                line = prefix + line[start:end] + suffix
            else:
                head = limit // 4
                tail = limit - head
                line = f"{line[:head]} [... {len(line) - limit} characters omitted ...] {line[-tail:]}"
        selected[index] = line
        remaining -= len(line) + 1
    result = []
    previous = -1
    for index in sorted(selected):
        if index > previous + 1:
            result.append(f"[... {index - previous - 1} lines omitted ...]")
        result.append(selected[index])
        previous = index
    if previous < len(lines) - 1:
        result.append(f"[... {len(lines) - previous - 1} lines omitted ...]")
    return "\n".join(result), True


def code_block(text):
    fence = "`" * max(3, max((len(m.group()) + 1 for m in re.finditer(r"`+", text)), default=3))
    return f"{fence}text\n{text}\n{fence}"


def inline(value):
    return str(value if value is not None else "不明").replace("\r", " ").replace("\n", " ")


def render_markdown(repo, run_id, job_id, job, run, logs, note):
    job_url = f"https://github.com/{repo}/actions/runs/{run_id}/job/{job_id}"
    parts = [
        "# GitHub Actions CI Failure", "", "## 対象", "",
        f"- Repository: {repo}",
        f"- Workflow: {inline(run.get('name') or job.get('workflow_name'))}",
        f"- Job: {inline(job.get('name'))}",
        f"- Branch: {inline(job.get('head_branch') or run.get('head_branch'))}",
        f"- Commit: {inline(job.get('head_sha') or run.get('head_sha'))}",
        f"- Event: {inline(run.get('event'))}",
        f"- Run: {run_id} / Attempt: {job['run_attempt']}",
        f"- Conclusion: {inline(job.get('conclusion'))}",
        f"- Started: {inline(job.get('started_at'))}",
        f"- Completed: {inline(job.get('completed_at'))}",
        f"- Job URL: {job_url}",
    ]
    for pr in run.get("pull_requests") or []:
        if pr.get("number"):
            parts.append(f"- PR: https://github.com/{repo}/pull/{pr['number']}")
    parts.extend(["", "## 失敗したステップ", ""])
    failed_steps = [
        step for step in job.get("steps", [])
        if step.get("conclusion") in {"failure", "timed_out", "cancelled"}
    ]
    if failed_steps:
        for step in failed_steps:
            parts.append(f"- Step {step.get('number')}: {inline(step.get('name'))} ({step.get('conclusion')})")
    else:
        parts.append("ステップ単位の失敗情報はありません。ジョブの終了理由とログを確認してください。")
    excerpt, truncated = excerpt_log(logs)
    parts.extend(["", "## ログ", "", note])
    if truncated:
        parts.append(
            f"ログが長いため、エラー行とその前後、先頭、末尾を優先して抜粋しました（最大 {MAX_LOG_LINES} 行 / {MAX_LOG_CHARS:,} 文字、"
            "省略表示を除く）。全文は Job URL から確認してください。"
        )
    parts.extend(["", code_block(excerpt), ""])
    return "\n".join(parts)


def main(argv=None):
    arguments = sys.argv[1:] if argv is None else argv
    try:
        if len(arguments) > 1:
            raise CommandError("job URL は 1 つ指定してください。")
        url = arguments[0].strip() if arguments else ""
        if not url:
            url = run_command(["pbpaste"]).strip()
        repo, run_id, job_id = parse_job_url(url)
        gh = find_gh()
        job, run, logs, note = fetch_failure(gh, repo, run_id, job_id)
        markdown = render_markdown(repo, run_id, job_id, job, run, logs, note)
        run_command(["pbcopy"], input_text=markdown)
        print("✅ CI の失敗情報を Markdown でコピーしました。")
        return 0
    except (CommandError, OSError) as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
