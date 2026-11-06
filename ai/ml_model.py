import pandas as pd
from sklearn.ensemble import IsolationForest


class PredictiveAnomalyModel:

    def __init__(self):

        self.model = IsolationForest(
            n_estimators=100,
            contamination=0.05,
            random_state=42
        )

        self.is_trained = False

    # =====================================================
    # TRAIN MODEL
    # =====================================================

    def train(self, data):

        required_features = [
            "cpu",
            "memory",
            "latency",
            "error_rate"
        ]

        # Check that all required columns exist
        missing_features = [
            feature
            for feature in required_features
            if feature not in data.columns
        ]

        if missing_features:

            raise ValueError(
                f"Missing training features: {missing_features}"
            )

        # Use exactly the same columns during training
        training_data = data[required_features]

        self.model.fit(training_data)

        self.is_trained = True

        print(
            "ML model trained with 4 features:"
        )

        print(
            "CPU + Memory + Latency + Error Rate"
        )

    # =====================================================
    # PREDICT ANOMALY
    # =====================================================

    def predict(
        self,
        cpu,
        memory,
        latency,
        error_rate
    ):

        if not self.is_trained:

            return {
                "status": "MODEL_NOT_TRAINED",
                "anomaly": False,
                "score": 0.0
            }

        # Create DataFrame with EXACT same
        # feature names and order used during training

        input_data = pd.DataFrame(
            [[
                cpu,
                memory,
                latency,
                error_rate
            ]],
            columns=[
                "cpu",
                "memory",
                "latency",
                "error_rate"
            ]
        )

        # ML prediction
        prediction = self.model.predict(
            input_data
        )

        # Anomaly score
        anomaly_score = self.model.decision_function(
            input_data
        )[0]

        # Determine status
        if prediction[0] == -1:

            status = "ANOMALY"

        else:

            status = "NORMAL"

        return {
            "status": status,
            "anomaly": bool(prediction[0] == -1),
            "score": float(anomaly_score)
        }