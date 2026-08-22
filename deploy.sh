#!/bin/bash
# Script deploy ERMApp ke server Linux Mint
# Jalankan dari dalam folder ERMApp: bash deploy.sh

set -e

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVICE_NAME="ermapp-backend"
WA_SERVICE_NAME="wa-gateway"
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
echo "=== Deploy WhatsApp Gateway (wa-gateway/) ==="

# 7. Cek Node.js
if ! command -v node &>/dev/null; then
  echo "Node.js belum terinstall. Install Node.js LTS via NodeSource..."
  curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
  sudo apt-get install -y nodejs
  echo "Node.js terinstall: $(node -v)"
fi

# 8. Setup .env wa-gateway jika belum ada
if [ ! -f "$APP_DIR/wa-gateway/.env" ]; then
  cp "$APP_DIR/wa-gateway/.env.example" "$APP_DIR/wa-gateway/.env"
  RANDOM_KEY=$(openssl rand -hex 24)
  sed -i "s/ganti-dengan-string-acak/$RANDOM_KEY/" "$APP_DIR/wa-gateway/.env"
  echo ""
  echo "PERHATIAN: API_KEY wa-gateway di-generate otomatis: $RANDOM_KEY"
  echo "Isi juga URL (http://localhost:3200) & API Key ini yang sama persis"
  echo "di Admin > Pengaturan Bridging > WhatsApp Gateway di aplikasi."
fi

# 9. Install dependencies wa-gateway
echo "Install dependencies wa-gateway..."
cd "$APP_DIR/wa-gateway"
npm install --omit=dev
echo "Install selesai."

# 10. Buat systemd service wa-gateway
sudo tee /etc/systemd/system/${WA_SERVICE_NAME}.service > /dev/null <<EOF
[Unit]
Description=ERMApp WhatsApp Gateway (Baileys)
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$APP_DIR/wa-gateway
ExecStart=$(command -v node) index.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# 11. Aktifkan service wa-gateway
sudo systemctl daemon-reload
sudo systemctl enable $WA_SERVICE_NAME
sudo systemctl restart $WA_SERVICE_NAME

echo ""
echo "=== Deploy selesai ==="
echo "Backend:"
echo "  Status: sudo systemctl status $SERVICE_NAME"
echo "  Log:    sudo journalctl -u $SERVICE_NAME -f"
echo "WhatsApp Gateway:"
echo "  Status: sudo systemctl status $WA_SERVICE_NAME"
echo "  Log:    sudo journalctl -u $WA_SERVICE_NAME -f"
echo "  Pairing: buka Admin > Pengaturan Bridging > WhatsApp Gateway > Pairing (Scan QR)"
