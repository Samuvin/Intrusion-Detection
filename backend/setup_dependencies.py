"""
Setup script for installing dependencies and preparing the backend environment.
"""

import subprocess
import sys
import os
from pathlib import Path

def install_requirements():
    """Install Python requirements."""
    requirements_file = Path(__file__).parent / "requirements.txt"
    
    if not requirements_file.exists():
        print("❌ requirements.txt not found!")
        return False
    
    try:
        print("📦 Installing Python dependencies...")
        subprocess.check_call([
            sys.executable, "-m", "pip", "install", "-r", str(requirements_file)
        ])
        print("✅ Dependencies installed successfully!")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to install dependencies: {e}")
        return False

def create_directories():
    """Create necessary directories."""
    directories = [
        "models",
        "datasets",
        "logs",
        "temp"
    ]
    
    for directory in directories:
        dir_path = Path(__file__).parent / directory
        dir_path.mkdir(exist_ok=True)
        print(f"📁 Created directory: {directory}")

def setup_environment():
    """Setup environment file."""
    env_example = Path(__file__).parent / ".env.example"
    env_file = Path(__file__).parent / ".env"
    
    if env_example.exists() and not env_file.exists():
        try:
            with open(env_example, 'r') as src:
                content = src.read()
            
            with open(env_file, 'w') as dst:
                dst.write(content)
            
            print("📄 Created .env file from .env.example")
            print("⚠️  Please review and update the .env file with your settings")
        except Exception as e:
            print(f"❌ Failed to create .env file: {e}")

def test_installation():
    """Test if key packages can be imported."""
    test_packages = [
        "fastapi",
        "uvicorn",
        "sklearn",
        "xgboost",
        "pandas",
        "numpy"
    ]
    
    print("🧪 Testing package imports...")
    
    for package in test_packages:
        try:
            __import__(package)
            print(f"✅ {package}: OK")
        except ImportError as e:
            print(f"❌ {package}: FAILED - {e}")
            return False
    
    return True

def main():
    """Main setup function."""
    print("🚀 Setting up NIDS Backend Environment")
    print("=" * 50)
    
    # Create directories
    create_directories()
    
    # Setup environment
    setup_environment()
    
    # Install requirements
    if not install_requirements():
        sys.exit(1)
    
    # Test installation
    if not test_installation():
        print("❌ Setup completed with errors. Please check the installation.")
        sys.exit(1)
    
    print("\n" + "=" * 50)
    print("✅ Backend setup completed successfully!")
    print("\nNext steps:")
    print("1. Review and update the .env file")
    print("2. Run the server: python run.py")
    print("3. Access API docs at: http://localhost:8000/api/docs")

if __name__ == "__main__":
    main()
