"""Regression checks for incidents being created before telemetry is initialized."""
import importlib
import os
from pathlib import Path
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch


class IncidentStartupTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Import the real handlers with an isolated SQLite database.
        cls.test_root = Path(__file__).resolve().parent
        cls.temp = tempfile.TemporaryDirectory(prefix=".incident-startup-", dir=cls.test_root)
        sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
        previous = os.getcwd()
        try:
            os.chdir(cls.temp.name)
            cls.api = importlib.import_module("app.main")
        finally:
            os.chdir(previous)

    @classmethod
    def tearDownClass(cls):
        cls.api.engine.dispose()
        # Only clean up the unique test directory created inside this workspace.
        Path(cls.temp.name).resolve().relative_to(cls.test_root)
        cls.temp.cleanup()

    def setUp(self):
        self.api.SYSTEM_METRICS_READY.clear()
        self.api.SYSTEM_CPU_USAGE.set(0)
        self.api.SYSTEM_MEMORY_USAGE.set(0)
        self.api.incident_manager.incidents.clear()

    def test_endpoints_reject_uninitialized_metrics(self):
        for handler in (self.api.system_metrics, self.api.ai_analysis, self.api.self_healing):
            with self.subTest(handler=handler.__name__):
                with self.assertRaises(self.api.HTTPException) as error:
                    handler()
                self.assertEqual(error.exception.status_code, 503)
        self.assertEqual(self.api.incident_manager.get_incidents(), [])

    def test_background_detector_waits_without_creating_an_incident(self):
        with patch.object(self.api.SYSTEM_METRICS_READY, "wait", side_effect=[False, StopIteration]), \
                patch.object(self.api.ml_model, "predict") as predict:
            with self.assertRaises(StopIteration):
                self.api.automatic_self_healing()
            predict.assert_not_called()
        self.assertEqual(self.api.incident_manager.get_incidents(), [])

    def test_first_complete_sample_is_ready_even_with_idle_cpu(self):
        with patch.object(self.api.psutil, "cpu_percent", return_value=0.0), \
                patch.object(self.api.psutil, "virtual_memory", return_value=SimpleNamespace(percent=61.2)), \
                patch.object(self.api.time, "sleep", side_effect=StopIteration):
            with self.assertRaises(StopIteration):
                self.api.update_system_metrics()
        self.assertTrue(self.api.SYSTEM_METRICS_READY.is_set())
        metrics = self.api.system_metrics()
        self.assertEqual(metrics["cpu_usage_percent"], 0.0)
        self.assertEqual(metrics["memory_usage_percent"], 61.2)

    def test_failed_collection_does_not_enable_detection(self):
        with patch.object(self.api.psutil, "cpu_percent", return_value=25.0), \
                patch.object(self.api.psutil, "virtual_memory", side_effect=RuntimeError("collection failed")), \
                patch.object(self.api.time, "sleep", side_effect=StopIteration):
            with self.assertRaises(StopIteration):
                self.api.update_system_metrics()
        self.assertFalse(self.api.SYSTEM_METRICS_READY.is_set())


if __name__ == "__main__":
    unittest.main()
