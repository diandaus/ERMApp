#!/bin/bash
# Script deploy ERMApp ke server Linux Mint
# Jalankan dari dalam folder ERMApp: bash deploy.sh

set -e

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVICE_NAME="ermapp-backend"
GO_VERSION="1.22.3"

echo "=== Deploy ERMApp Backend ==="
echo "Direktori: $APP_DIR"

# 1. Cek Go
if ! command -v go &>/dev/null; then
  echo "Go belum terinstall. Install Go $GO_VERSION..."
  wget -q "https://go.dev/dl/go${GO_VERSION}.linux-amd64.tar.gz" -O /tmp/go.tar.gz
  sudo rm -rf /usr/local/go
  sudo tar -C /usr/local -xzf /tmp/go.tar.gz
  echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.bashrc
  export PATH=$PATH:/usr/local/go/bin
  echo "Go terinstall: $(go version)"
fi

# 2. Setup .env jika belum ada
if [ ! -f "$APP_DIR/backend/.env" ]; then
  cp "$APP_DIR/backend/.env.example" "$APP_DIR/backend/.env"
  echo ""
  echo "PERHATIAN: Edit file .env terlebih dahulu:"
  echo "  nano $APP_DIR/backend/.env"
  echo "Lalu jalankan deploy.sh lagi."
  exit 1
fi

# 3. Build backend
echo "Build backend..."
cd "$APP_DIR/backend"
go build -o ermapp-backend .
echo "Build selesai."

# 4. Setup direktori worklist Orthanc
sudo mkdir -p /var/lib/orthanc/worklists
sudo chown "$USER:$USER" /var/lib/orthanc/worklists
echo "Worklist dir: /var/lib/orthanc/worklists"

# 5. Buat systemd service
sudo tee /etc/systemd/system/${SERVICE_NAME}.service > /dev/null <<EOF
[Unit]
Description=ERMApp Backend
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$APP_DIR/backend
ExecStart=$APP_DIR/backend/ermapp-backend
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# 6. Aktifkan service
sudo systemctl daemon-reload
sudo systemctl enable $SERVICE_NAME
sudo systemctl restart $SERVICE_NAME

echo ""
echo "=== Deploy selesai ==="
echo "Status: sudo systemctl status $SERVICE_NAME"
echo "Log:    sudo journalctl -u $SERVICE_NAME -f"
