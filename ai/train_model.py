import pandas as pd

from ml_model import PredictiveAnomalyModel


# Load training data
data = pd.read_csv("training_data.csv")


# Select features
features = data[
    [
        "cpu",
        "memory",
        "latency",
        "error_rate"
    ]
]


# Create model
model = PredictiveAnomalyModel()


# Train model
model.train(features)

print("ML model trained successfully!")


# Normal test
normal_test = model.predict(
    35,
    55,
    0.20,
    0
)

print("Normal test:")
print(normal_test)


# Anomaly test
anomaly_test = model.predict(
    95,
    95,
    2.0,
    10
)

print("Anomaly test:")
print(anomaly_test)