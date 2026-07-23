"""
AquaGuard – Mangrove Health Classification Model
=================================================
Random Forest classifier using field data from KoboToolbox
and NDVI values from Copernicus Sentinel-2 imagery.

Features used:
  - canopy_cover_pct   : Estimated canopy cover (%)
  - ndvi               : Mean NDVI from Copernicus (0.0 – 1.0)
  - species_count      : Number of tree species observed
  - avg_height_m       : Average tree height (meters)
  - gbh_cm             : Girth at breast height (cm)
  - seedling_count     : Number of seedlings in quadrat
  - sapling_count      : Number of saplings in quadrat
  - mollusk_count      : Number of mollusks observed

Target label:
  - health_status      : Healthy / Moderate / Degraded

Usage:
  python train.py
"""

import os
import pickle
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score
from sklearn.preprocessing import LabelEncoder

# ─────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────

DATA_PATH  = "data/field_data.csv"   # replace with real KoboToolbox CSV export later
MODEL_PATH = "model.pkl"
LABEL_PATH = "label_encoder.pkl"

FEATURES = [
    "canopy_cover_pct",
    "ndvi",
    "species_count",
    "avg_height_m",
    "gbh_cm",
    "seedling_count",
    "sapling_count",
    "mollusk_count",
]

TARGET = "health_status"

# ─────────────────────────────────────────────
# STEP 1 — LOAD DATA
# ─────────────────────────────────────────────

def load_data(path):
    """
    Load field data CSV.
    If real data doesn't exist yet, generate synthetic dummy data
    so the pipeline can be tested end-to-end.
    """
    if os.path.exists(path):
        print(f"[✓] Loading real data from {path}")
        df = pd.read_csv(path)
    else:
        print("[!] No real data found. Using synthetic dummy data for pipeline testing.")
        print("    Replace data/field_data.csv with your KoboToolbox CSV export later.\n")
        df = generate_dummy_data()

    print(f"    Rows loaded: {len(df)}")
    print(f"    Label distribution:\n{df[TARGET].value_counts()}\n")
    return df


def generate_dummy_data(n=120):
    """
    Generate synthetic training data that mirrors the structure
    of real KoboToolbox + Copernicus NDVI exports.
    Reflects realistic mangrove field conditions in Calatagan.
    """
    np.random.seed(42)
    rows = []

    # Healthy zone profile
    for _ in range(40):
        rows.append({
            "canopy_cover_pct": np.random.uniform(70, 90),
            "ndvi":             np.random.uniform(0.60, 0.85),
            "species_count":    np.random.randint(3, 7),
            "avg_height_m":     np.random.uniform(5.0, 12.0),
            "gbh_cm":           np.random.uniform(20.0, 55.0),
            "seedling_count":   np.random.randint(8, 25),
            "sapling_count":    np.random.randint(5, 18),
            "mollusk_count":    np.random.randint(10, 40),
            "health_status":    "Healthy",
        })

    # Moderate zone profile
    for _ in range(40):
        rows.append({
            "canopy_cover_pct": np.random.uniform(45, 70),
            "ndvi":             np.random.uniform(0.30, 0.60),
            "species_count":    np.random.randint(2, 5),
            "avg_height_m":     np.random.uniform(3.0, 7.0),
            "gbh_cm":           np.random.uniform(10.0, 30.0),
            "seedling_count":   np.random.randint(3, 12),
            "sapling_count":    np.random.randint(2, 10),
            "mollusk_count":    np.random.randint(4, 18),
            "health_status":    "Moderate",
        })

    # Degraded zone profile
    for _ in range(40):
        rows.append({
            "canopy_cover_pct": np.random.uniform(5, 45),
            "ndvi":             np.random.uniform(0.00, 0.30),
            "species_count":    np.random.randint(1, 3),
            "avg_height_m":     np.random.uniform(1.0, 4.0),
            "gbh_cm":           np.random.uniform(3.0, 15.0),
            "seedling_count":   np.random.randint(0, 5),
            "sapling_count":    np.random.randint(0, 4),
            "mollusk_count":    np.random.randint(0, 8),
            "health_status":    "Degraded",
        })

    df = pd.DataFrame(rows)

    # Save dummy data so it can be inspected
    os.makedirs("data", exist_ok=True)
    df.to_csv("data/dummy_field_data.csv", index=False)
    print("    Dummy data saved to data/dummy_field_data.csv for reference.\n")
    return df


# ─────────────────────────────────────────────
# STEP 2 — PREPARE FEATURES & LABELS
# ─────────────────────────────────────────────

def prepare(df):
    """
    Validate columns, encode labels, split into train/test sets.
    """
    # Check all required columns exist
    missing = [c for c in FEATURES + [TARGET] if c not in df.columns]
    if missing:
        raise ValueError(f"Missing columns in data: {missing}\n"
                         f"Expected: {FEATURES + [TARGET]}")

    # Drop rows with missing values in feature columns
    before = len(df)
    df = df.dropna(subset=FEATURES + [TARGET])
    dropped = before - len(df)
    if dropped > 0:
        print(f"[!] Dropped {dropped} rows with missing values.")

    X = df[FEATURES].values
    y_raw = df[TARGET].values

    # Encode labels: Healthy=0, Moderate=1, Degraded=2
    le = LabelEncoder()
    y = le.fit_transform(y_raw)
    print(f"[✓] Label classes: {list(le.classes_)}\n")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    print(f"    Training samples : {len(X_train)}")
    print(f"    Test samples     : {len(X_test)}\n")

    return X_train, X_test, y_train, y_test, le


# ─────────────────────────────────────────────
# STEP 3 — TRAIN MODEL
# ─────────────────────────────────────────────

def train(X_train, y_train):
    """
    Train a Random Forest classifier.
    n_estimators=100 is a reliable default for small-to-medium datasets.
    """
    print("[✓] Training Random Forest classifier...")
    model = RandomForestClassifier(
        n_estimators=100,
        max_depth=None,
        random_state=42,
        class_weight="balanced",   # handles unequal class sizes
    )
    model.fit(X_train, y_train)
    print("    Training complete.\n")
    return model


# ─────────────────────────────────────────────
# STEP 4 — EVALUATE
# ─────────────────────────────────────────────

def evaluate(model, X_test, y_test, le):
    """
    Print accuracy and per-class precision, recall, F1.
    """
    y_pred = model.predict(X_test)
    acc = accuracy_score(y_test, y_pred)

    print("=" * 48)
    print(f"  Model Accuracy: {acc * 100:.1f}%")
    print("=" * 48)
    print(classification_report(
        y_test, y_pred,
        target_names=le.classes_
    ))

    # Feature importance
    print("Feature importances:")
    importances = model.feature_importances_
    for feat, imp in sorted(zip(FEATURES, importances), key=lambda x: -x[1]):
        bar = "█" * int(imp * 40)
        print(f"  {feat:<22} {bar} {imp:.3f}")
    print()


# ─────────────────────────────────────────────
# STEP 5 — SAVE MODEL
# ─────────────────────────────────────────────

def save(model, le):
    """
    Export trained model and label encoder as .pkl files.
    These are loaded by the web app to make predictions.
    """
    with open(MODEL_PATH, "wb") as f:
        pickle.dump(model, f)
    print(f"[✓] Model saved to {MODEL_PATH}")

    with open(LABEL_PATH, "wb") as f:
        pickle.dump(le, f)
    print(f"[✓] Label encoder saved to {LABEL_PATH}")


# ─────────────────────────────────────────────
# STEP 6 — SAMPLE PREDICTION
# ─────────────────────────────────────────────

def sample_predict(model, le):
    """
    Run a quick sample prediction to verify the saved model works.
    Replace these values with a real submission when testing.
    """
    sample = pd.DataFrame([{
        "canopy_cover_pct": 74.0,
        "ndvi":             0.65,
        "species_count":    4,
        "avg_height_m":     7.2,
        "gbh_cm":           28.5,
        "seedling_count":   12,
        "sapling_count":    8,
        "mollusk_count":    22,
    }])

    pred_encoded = model.predict(sample[FEATURES].values)
    pred_label   = le.inverse_transform(pred_encoded)[0]
    pred_proba   = model.predict_proba(sample[FEATURES].values)[0]

    print("─" * 48)
    print("  Sample prediction (Sta. Ana-like profile):")
    print(f"  → Predicted health status : {pred_label}")
    for cls, prob in zip(le.classes_, pred_proba):
        bar = "█" * int(prob * 30)
        print(f"     {cls:<12} {bar} {prob:.2f}")
    print("─" * 48)


# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────

if __name__ == "__main__":
    print("\n╔══════════════════════════════════════════════╗")
    print("║  AquaGuard – Mangrove Health Model Training  ║")
    print("╚══════════════════════════════════════════════╝\n")

    df                              = load_data(DATA_PATH)
    X_train, X_test, y_train, y_test, le = prepare(df)
    model                           = train(X_train, y_train)
    evaluate(model, X_test, y_test, le)
    save(model, le)
    sample_predict(model, le)

    print("\n[✓] Done. To use real data:")
    print("    1. Export KoboToolbox submissions as CSV")
    print("    2. Add NDVI column from Copernicus per submission")
    print("    3. Rename columns to match FEATURES list above")
    print("    4. Save as data/field_data.csv and re-run train.py\n")