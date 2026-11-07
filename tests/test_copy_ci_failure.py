import copy
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import unittest
from contextlib import redirect_stderr, redirect_stdout
from unittest.mock import patch


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "copy-ci-failure.py"
SPEC = importlib.util.spec_from_file_location("copy_ci_failure", SCRIPT)
ci = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(ci)

URL = "https://github.com/example/web/actions/runs/100/job/200"
JOB = {
    "id": 200,
    "run_id": 100,
    "run_attempt": 2,
    "status": "completed",
    "conclusion": "failure",
    "name": "test (ubuntu)",
    "head_branch": "fix/login",
    "head_sha": "abc1234",
    "started_at": "2026-10-30T12:00:00Z",
    "completed_at": "2026-10-30T12:01:00Z",
    "steps": [
        {"number": 1, "name": "Checkout", "conclusion": "success"},
        {"number": 2, "name": "Run npm test", "conclusion": "failure"},
    ],
}
RUN = {
    "id": 100,
    "run_attempt": 2,
    "status": "completed",
    "name": "CI",
    "event": "pull_request",
    "pull_requests": [{"number": 123}],
}


class JobURLTests(unittest.TestCase):
    def test_job_url_accepts_query_fragment_and_trailing_slash(self):
        for suffix in ("", "/", "?check_suite_focus=true#step:2:20"):
            with self.subTest(suffix=suffix):
                self.assertEqual(ci.parse_job_url(f" {URL}{suffix}\n"), ("example/web", 100, 200))

    def test_rejects_non_job_urls_and_untrusted_hosts(self):
        invalid = (
            "", "not a URL", URL.replace("https:", "http:"),
            URL.replace("github.com", "github.com.evil.example"),
            URL.replace("github.com", "github.com@evil.example"),
            URL.replace("github.com", "user@github.com"),
            URL.replace("github.com", "github.com:443"),
            URL.replace("web/actions", "../actions"),
            URL.replace("/job/200", ""), URL.replace("/job/200", "/job/0"),
            URL.replace("/job/200", "/job/200;echo injected"),
            URL.replace("/web/", "/web%2Fother/"), "https://[invalid",
        )
        for url in invalid:
            with self.subTest(url=url), self.assertRaises(ci.CommandError):
                ci.parse_job_url(url)


class FetchFailureTests(unittest.TestCase):
    def fetch(self, job=None, run=None, log="failure detail"):
        job = copy.deepcopy(JOB if job is None else job)
        run = copy.deepcopy(RUN if run is None else run)
        with patch.object(ci, "gh_json", side_effect=[job, run]) as api:
            with patch.object(ci, "run_command", return_value=log) as command:
                result = ci.fetch_failure("gh", "example/web", 100, 200)
        return result, api, command

    def test_pins_metadata_and_logs_to_original_rerun_attempt(self):
        result, api, command = self.fetch()
        self.assertEqual(api.call_args_list[1].args[1], "repos/example/web/actions/runs/100/attempts/2")
        args = command.call_args.args[0]
        self.assertEqual(args[args.index("--attempt") + 1], "2")
        self.assertEqual(args[args.index("--job") + 1], "200")
        self.assertEqual(args[args.index("--repo") + 1], "github.com/example/web")
        self.assertIn("--log-failed", args)
        self.assertEqual(result[2], "failure detail")

    def test_rejects_mismatched_job_before_fetching_logs(self):
        for field, value in (("run_id", 999), ("id", 999)):
            job = dict(JOB, **{field: value})
            with self.subTest(field=field), patch.object(ci, "gh_json", return_value=job):
                with patch.object(ci, "run_command") as command:
                    with self.assertRaises(ci.CommandError):
                        ci.fetch_failure("gh", "example/web", 100, 200)
                    command.assert_not_called()

    def test_rejects_in_progress_or_successful_job(self):
        for change in ({"status": "in_progress"}, {"conclusion": "success"}, {"run_attempt": None}):
            with self.subTest(change=change), patch.object(ci, "gh_json", return_value=dict(JOB, **change)):
                with self.assertRaises(ci.CommandError):
                    ci.fetch_failure("gh", "example/web", 100, 200)

    def test_completed_job_can_be_copied_while_other_jobs_run(self):
        result, _, command = self.fetch(run=dict(RUN, status="in_progress"))
        args = command.call_args.args[0]
        self.assertIn("api", args)
        self.assertEqual(args[-1], "repos/example/web/actions/jobs/200/logs")
        self.assertEqual(args[args.index("--hostname") + 1], "github.com")
        self.assertIn("ジョブ全体", result[3])

    def test_empty_or_unavailable_failed_log_falls_back_to_job_log(self):
        for failed_log in ("  \n", ci.CommandError("failed to get run log")):
            with self.subTest(failed_log=failed_log):
                with patch.object(ci, "gh_json", side_effect=[copy.deepcopy(JOB), copy.deepcopy(RUN)]):
                    with patch.object(ci, "run_command", side_effect=[failed_log, "full job log"]) as command:
                        result = ci.fetch_failure("gh", "example/web", 100, 200)
                self.assertEqual(command.call_count, 2)
                self.assertEqual(result[2], "full job log")
                self.assertIn("ジョブ全体", result[3])

    def test_raw_log_retry_allows_ansi_then_removes_escape_sequences(self):
        with patch.object(ci, "gh_json", side_effect=[copy.deepcopy(JOB), dict(RUN, status="in_progress")]):
            with patch.object(ci, "run_command", side_effect=[
                ci.CommandError("the response contains terminal escape sequences"),
                "\x1b[31mFAIL\x1b[0m\r\n\x1b]8;;https://example.com\x07details\x1b]8;;\x07",
            ]) as command:
                result = ci.fetch_failure("gh", "example/web", 100, 200)
        self.assertIn("--allow-escape-sequences", command.call_args.args[0])
        self.assertEqual(result[2], "FAIL\ndetails")

    def test_missing_or_empty_job_logs_fail(self):
        for log in ("", ci.CommandError("gh: Gone (HTTP 410)")):
            with self.subTest(log=log), patch.object(ci, "gh_json", side_effect=[copy.deepcopy(JOB), dict(RUN, status="in_progress")]):
                with patch.object(ci, "run_command", side_effect=[log]):
                    with self.assertRaises(ci.CommandError):
                        ci.fetch_failure("gh", "example/web", 100, 200)


class MarkdownTests(unittest.TestCase):
    def render(self, logs="FAIL login test"):
        return ci.render_markdown("example/web", 100, 200, JOB, RUN, logs, "failed-step log")

    def test_contains_source_commit_pr_and_failed_step(self):
        markdown = self.render()
        for text in (URL, "fix/login", "abc1234", "Attempt: 2", "/pull/123", "Step 2: Run npm test", "FAIL login test"):
            self.assertIn(text, markdown)
        self.assertNotIn("Step 1: Checkout", markdown)

    def test_log_backticks_cannot_close_markdown_fence(self):
        log = "before\n````\n# still log output\nafter"
        block = ci.code_block(log)
        opening, *_, closing = block.splitlines()
        self.assertEqual(opening, closing + "text")
        self.assertGreater(len(closing), 4)
        self.assertIn(log, block)

    def test_large_logs_have_explicit_omission_and_preserve_both_ends(self):
        log = "\n".join(f"line {index}" for index in range(ci.MAX_LOG_LINES + 50))
        markdown = self.render(log)
        self.assertIn("line 0\n", markdown)
        self.assertIn(f"line {ci.MAX_LOG_LINES + 49}", markdown)
        self.assertIn("omitted", markdown)
        self.assertIn("全文は Job URL", markdown)
        long_line = "START" + "x" * (ci.MAX_LOG_CHARS + 100) + "END"
        excerpt, truncated = ci.excerpt_log(long_line)
        self.assertTrue(truncated)
        self.assertTrue(excerpt.startswith("START"))
        self.assertTrue(excerpt.endswith("END"))
        self.assertIn("omitted", excerpt)

    def test_middle_root_cause_and_context_survive_long_cleanup_output(self):
        before = [f"setup output {index}" for index in range(300)]
        context_before = [f"request context before {index}" for index in range(10)]
        root_cause = "##[error] Database connection refused: request-id=important"
        context_after = [f"stack context after {index}" for index in range(10)]
        cleanup = [f"cleanup output {index}" for index in range(ci.MAX_LOG_LINES + 300)]
        log = "\n".join(before + context_before + [root_cause] + context_after + cleanup)

        excerpt, truncated = ci.excerpt_log(log)

        self.assertTrue(truncated)
        self.assertIn(root_cause, excerpt)
        for line in context_before + context_after:
            self.assertIn(line, excerpt)
        self.assertIn("lines omitted", excerpt)
        self.assertIn(cleanup[-1], excerpt)

    def test_character_heavy_logs_keep_middle_error_and_mark_omissions(self):
        lines = [f"diagnostic {index}: " + "x" * 1800 for index in range(120)]
        root_cause = "##[error] Cannot find module 'auth-provider' (TS2307)"
        lines[60] = root_cause
        log = "\n".join(lines)
        self.assertLess(len(lines), ci.MAX_LOG_LINES)
        self.assertGreater(len(log), ci.MAX_LOG_CHARS)

        excerpt, truncated = ci.excerpt_log(log)

        self.assertTrue(truncated)
        self.assertIn(root_cause, excerpt)
        self.assertIn("omitted", excerpt)
        self.assertLess(len(excerpt), len(log))

    def test_single_very_long_line_preserves_middle_error_and_nearby_detail(self):
        root_cause = "##[error] Cannot connect to database: ECONNREFUSED 127.0.0.1:5432"
        line = "x" * ci.MAX_LOG_CHARS + " request-id=important " + root_cause + " retry=3 " + "y" * ci.MAX_LOG_CHARS

        excerpt, truncated = ci.excerpt_log(line)

        self.assertTrue(truncated)
        self.assertIn(root_cause, excerpt)
        self.assertIn("request-id=important", excerpt)
        self.assertIn("retry=3", excerpt)
        self.assertIn("characters omitted", excerpt)
        self.assertLess(len(excerpt), len(line))


class MainTests(unittest.TestCase):
    def invoke(self, arguments, *, api_error=False, clipboard=URL):
        writes = []

        def process(args, **kwargs):
            output = ""
            if args == ["pbpaste"]:
                output = clipboard
            elif args == ["pbcopy"]:
                writes.append(kwargs["input"])
            elif "api" in args:
                if api_error:
                    return subprocess.CompletedProcess(args, 1, "", "gh: authentication required")
                if args[-1].endswith("/jobs/200"):
                    output = json.dumps(JOB)
                elif args[-1].endswith("/attempts/2"):
                    output = json.dumps(RUN)
                else:
                    self.fail(f"Unexpected API endpoint: {args}")
            elif args[1:3] == ["run", "view"]:
                output = "test\tRun npm test\tFAIL login test"
            else:
                self.fail(f"Unexpected command: {args}")
            return subprocess.CompletedProcess(args, 0, output, "")

        with patch.object(ci, "find_gh", return_value="gh"):
            with patch.object(ci.subprocess, "run", side_effect=process) as process_mock:
                with redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
                    status = ci.main(arguments)
        return status, writes, process_mock

    def test_explicit_url_takes_precedence_over_clipboard(self):
        status, writes, process = self.invoke([URL], clipboard="unrelated text")
        self.assertEqual(status, 0)
        self.assertEqual(len(writes), 1)
        self.assertIn("FAIL login test", writes[0])
        self.assertNotIn(["pbpaste"], [call.args[0] for call in process.call_args_list])
        self.assertEqual(process.call_args.args[0], ["pbcopy"])

    def test_absent_or_blank_argument_reads_clipboard(self):
        for arguments in ([], ["  "]):
            with self.subTest(arguments=arguments):
                status, writes, process = self.invoke(arguments)
                self.assertEqual(status, 0)
                self.assertEqual(len(writes), 1)
                self.assertEqual(process.call_args_list[0].args[0], ["pbpaste"])

    def test_authentication_failure_does_not_change_clipboard(self):
        status, writes, _ = self.invoke([URL], api_error=True)
        self.assertEqual(status, 1)
        self.assertEqual(writes, [])

    def test_invalid_or_multiple_urls_do_not_change_clipboard(self):
        for arguments in (["https://evil.example/job/200"], [URL, URL]):
            with self.subTest(arguments=arguments):
                status, writes, process = self.invoke(arguments)
                self.assertEqual(status, 1)
                self.assertEqual(writes, [])
                process.assert_not_called()

    def test_subprocess_timeout_becomes_actionable_error(self):
        with patch.object(ci.subprocess, "run", side_effect=subprocess.TimeoutExpired("gh", 120)):
            with self.assertRaisesRegex(ci.CommandError, "タイムアウト"):
                ci.run_command(["gh", "api", "endpoint"])


if __name__ == "__main__":
    unittest.main()
