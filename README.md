# Network Intrusion Detection System (NIDS) Web Application

A hybrid Machine Learning-based Network Intrusion Detection System using SVM + XGBoost with Crow Search Algorithm optimization.

## Features

- **Hybrid ML Approach**: Combines SVM and XGBoost for robust intrusion detection
- **Feature Optimization**: XGBoost-based intelligent feature selection
- **Hyperparameter Tuning**: Crow Search Algorithm for optimal model performance
- **Real-time Monitoring**: Live network traffic analysis and threat detection
- **Interactive Dashboard**: Professional web interface with visualizations
- **Multi-dataset Support**: NSL-KDD and UNR-IDD dataset compatibility

## Architecture

```
├── backend/                 # Python FastAPI backend
│   ├── app/                # Main application
│   ├── ml/                 # ML models and algorithms
│   ├── data/               # Dataset processing
│   └── tests/              # Backend tests
├── frontend/               # React.js frontend
│   ├── src/                # Source code
│   ├── public/             # Static assets
│   └── tests/              # Frontend tests
├── datasets/               # Sample datasets
└── docs/                   # Documentation
```

## Quick Start

### Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python run.py
```

### Frontend Setup
```bash
cd frontend
npm install
npm start
```

## Performance Results

Based on research validation:

### NSL-KDD Dataset
- **Accuracy**: 96.8%
- **Precision**: 96.8%
- **Recall**: 96.6%
- **F1-Score**: 96.2%

### UNR-IDD Dataset
- **Accuracy**: 95.4%
- **Precision**: 95.0%
- **Recall**: 94.6%
- **F1-Score**: 94.8%

## Attack Types Detected

- **DoS**: Denial of Service attacks
- **Probe**: Surveillance and probing attacks
- **U2R**: User to Root privilege escalation
- **R2L**: Remote to Local unauthorized access

## License

MIT License
