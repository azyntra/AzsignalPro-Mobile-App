"""
train_model.py — Manually trigger ML model training.

Usage:
    PYTHONPATH=. python scripts/train_model.py

This reads all closed signals from the database and trains the
XGBoost win/loss classifier. The model is saved to models/signal_predictor.joblib.
"""
from src.database.db_logger import init_db
from src.analysis.ml_predictor import train_model


def main():
    init_db()
    print("🧠 Training ML signal predictor...\n")

    stats = train_model(min_signals=30)  # lower threshold for manual run

    if stats is None:
        print("❌ Not enough closed signals to train. Need at least 30.")
        print("   Wait for more signals to accumulate, then try again.")
        return

    print(f"\n✅ Model trained successfully!")
    print(f"   📊 Training data: {stats['total_signals']} signals "
          f"({stats['wins']}W / {stats['losses']}L)")
    print(f"   🎯 Cross-validation accuracy: {stats['cv_accuracy']}%")
    print(f"\n   🏆 Top predictive features:")
    for name, importance in stats["top_features"]:
        bar = "█" * int(importance * 50)
        print(f"      {name:20s} {bar} {importance:.3f}")

    print(f"\n   Model saved to: models/signal_predictor.joblib")
    print(f"   Enable with ML_PREDICTOR_ENABLED=True in config/settings.py")


if __name__ == "__main__":
    main()
