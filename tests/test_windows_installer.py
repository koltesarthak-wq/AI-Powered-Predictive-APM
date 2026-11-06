"""Installer validation, persistent downloads, service dispatch, and packaged telemetry."""
import importlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from agent.deployment.installer import validate_url, validate_id, load_deployment, InstallerBuildError, build_installer


class InstallerValidationTests(unittest.TestCase):
    def test_backend_urls(self):
        self.assertEqual(validate_url(' https://apm.example.test/api/ '), 'https://apm.example.test/api')
        self.assertEqual(validate_url('http://192.168.1.10:8001'), 'http://192.168.1.10:8001')
        for value in ('ftp://host', 'http://', 'http://user:secret@host', 'https://host/?key=secret',
                      'https://host/#fragment', 'http://host:wrong', 'http://host\n/script'):
            with self.subTest(value=value), self.assertRaises(ValueError):
                validate_url(value)

    def test_ids_cannot_escape_deployment_directory(self):
        for value in ('../release', '..\\release', '/absolute', 'a' * 33):
            with self.subTest(value=value), self.assertRaises(ValueError):
                validate_id(value)

    def test_unsupported_os_rejected_before_build(self):
        with self.assertRaisesRegex(ValueError, 'Windows x64'):
            build_installer(ROOT, 'a' * 32, 'host', 'Linux', 'http://localhost:8001', 5)

    def test_missing_compiler_is_actionable(self):
        with patch('agent.deployment.installer.find_compiler', side_effect=InstallerBuildError('Install Inno Setup')):
            with self.assertRaisesRegex(InstallerBuildError, 'Inno Setup'):
                build_installer(ROOT, 'a' * 32, 'host', 'Windows', 'http://localhost:8001', 5)

    @unittest.skipUnless(sys.platform == 'win32', 'Windows service entry point')
    def test_scm_launch_dispatches_without_installing_service(self):
        from agent import windows_service as service
        with patch.object(sys, 'argv', ['agent.exe']), \
                patch.object(service.servicemanager, 'Initialize') as initialize, \
                patch.object(service.servicemanager, 'PrepareToHostSingle') as prepare, \
                patch.object(service.servicemanager, 'StartServiceCtrlDispatcher') as dispatcher, \
                patch.object(service.win32serviceutil, 'HandleCommandLine') as cli:
            service.main()
        initialize.assert_called_once()
        prepare.assert_called_once_with(service.AIPredictiveAPMAgentService)
        dispatcher.assert_called_once()
        cli.assert_not_called()


class AgentDeliveryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.test_root = ROOT / 'tests'
        cls.temp = tempfile.TemporaryDirectory(prefix='.agent-delivery-', dir=cls.test_root)
        cls.directory = Path(cls.temp.name)
        previous = Path.cwd()
        try:
            os.chdir(cls.directory)
            cls.api = importlib.import_module('app.main')
        finally:
            os.chdir(previous)
        from fastapi.testclient import TestClient
        cls.client = TestClient(cls.api.app)

    @classmethod
    def tearDownClass(cls):
        cls.client.close()
        cls.api.engine.dispose()
        cls.directory.resolve().relative_to(cls.test_root)
        cls.temp.cleanup()

    def test_download_survives_empty_in_memory_state(self):
        deployment_id = 'b' * 32
        generated = self.directory / 'agent/deployment/generated'
        directory = generated / deployment_id
        directory.mkdir(parents=True)
        data = b'MZ-test-download'
        (directory / 'Setup.exe').write_bytes(data)
        (directory / 'deployment.json').write_text(json.dumps(dict(
            deployment_id=deployment_id, package='Setup.exe', sha256='test-hash')))
        with patch.object(self.api, 'PROJECT_ROOT', self.directory), \
                patch.object(self.api, 'AGENT_GENERATED_DIR', generated), \
                patch.dict(self.api.deployment_state, {'deployments': {}}):
            response = self.client.get(f'/agent/deployment/download/{deployment_id}')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, data)
        self.assertIn('Setup.exe', response.headers['content-disposition'])
        self.assertEqual(response.headers['content-type'], 'application/octet-stream')

    def test_missing_and_invalid_downloads_are_404(self):
        for identifier in ('not-an-id', 'f' * 32):
            self.assertEqual(self.client.get(f'/agent/deployment/download/{identifier}').status_code, 404)

    @unittest.skipUnless((ROOT / 'agent/deployment/release/runtime/AI-Predictive-APM-Agent.exe').exists(),
                         'Build the Windows runtime to run the packaged delivery test')
    def test_packaged_agent_sends_real_metrics_and_heartbeat(self):
        client = self.client
        received = []

        class Receiver(BaseHTTPRequestHandler):
            def do_POST(self):
                payload = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
                result = client.post(self.path, json=payload)
                received.append((self.path, payload))
                self.send_response(result.status_code)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(result.content)
            def log_message(self, *args):
                pass

        server = ThreadingHTTPServer(('127.0.0.1', 0), Receiver)
        server_thread = threading.Thread(target=server.serve_forever, daemon=True)
        server_thread.start()
        runtime = self.directory / 'runtime'
        shutil.copytree(ROOT / 'agent/deployment/release/runtime', runtime)
        (runtime / 'config.json').write_text(json.dumps(dict(
            agent_name='Packaged-Agent-Verification', collection_interval=5,
            backend_url=f'http://127.0.0.1:{server.server_port}')))
        try:
            result = subprocess.run([str(runtime / 'AI-Predictive-APM-Agent.exe'), '--check'],
                                    capture_output=True, text=True, timeout=90,
                                    creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertEqual([path for path, _ in received], ['/agent/metrics', '/agent/heartbeat'])
            metrics = received[0][1]
            self.assertGreater(metrics['memory_usage_percent'], 0)
            self.assertTrue(metrics['hostname'])
            self.assertEqual(self.api.agent_state['agent_name'], 'Packaged-Agent-Verification')
            self.assertEqual(self.api.agent_state['status'], 'ONLINE')
            self.assertEqual(self.api.agent_state['last_metrics']['hostname'], metrics['hostname'])
            print('Packaged EXE -> FastAPI: real host metrics accepted; status ONLINE.')
        finally:
            server.shutdown()
            server.server_close()
            server_thread.join(timeout=5)


if __name__ == '__main__':
    unittest.main()
