#!/usr/bin/env bash
# Configura Flutter nesta VM (Zorin/Ubuntu) usando o SDK em /media/sf_ScalWay/flutter
# Uso: bash scripts/setup-flutter-vm.sh
# Requer sudo para instalar dependências de sistema (clang, cmake, Android SDK opcional).

set -euo pipefail

FLUTTER_SRC="${FLUTTER_SRC:-/media/sf_ScalWay/flutter}"
FLUTTER_HOME="${FLUTTER_HOME:-$HOME/flutter-sdk}"
INSTALL_ANDROID="${INSTALL_ANDROID:-1}"
ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$HOME/Android/Sdk}"

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

log() { echo -e "${GREEN}==>${NC} $*"; }
warn() { echo -e "${RED}AVISO:${NC} $*"; }

if [[ ! -x "${FLUTTER_SRC}/bin/flutter" ]]; then
  echo "Flutter não encontrado em ${FLUTTER_SRC}/bin/flutter"
  exit 1
fi

# ---------------------------------------------------------------------------
# 1. SDK: symlink em ~/flutter-sdk (evita PATH longo; partilha o mesmo disco)
# ---------------------------------------------------------------------------
log "A preparar FLUTTER_HOME em ${FLUTTER_HOME}"
if [[ -L "$FLUTTER_HOME" ]] || [[ -d "$FLUTTER_HOME" ]]; then
  rm -rf "$FLUTTER_HOME"
fi
ln -sfn "$FLUTTER_SRC" "$FLUTTER_HOME"

# ---------------------------------------------------------------------------
# 2. Dependências Linux (requer sudo)
# ---------------------------------------------------------------------------
log "A instalar dependências de sistema (sudo)..."
sudo apt-get update -qq
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
  clang cmake ninja-build pkg-config \
  libgtk-3-dev liblzma-dev libstdc++-12-dev \
  curl unzip xz-utils zip libglu1-mesa \
  openjdk-17-jdk git

# ---------------------------------------------------------------------------
# 3. Android SDK (linha de comandos, sem Android Studio)
# ---------------------------------------------------------------------------
if [[ "$INSTALL_ANDROID" == "1" ]]; then
  log "A configurar Android SDK em ${ANDROID_SDK_ROOT}"
  mkdir -p "${ANDROID_SDK_ROOT}/cmdline-tools"

  CMDLINE_ZIP="/tmp/commandlinetools-linux.zip"
  if [[ ! -x "${ANDROID_SDK_ROOT}/cmdline-tools/latest/bin/sdkmanager" ]]; then
    log "A transferir Android command-line tools..."
    curl -fsSL -o "$CMDLINE_ZIP" \
      "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"
    rm -rf /tmp/cmdline-tools-unpack
    unzip -q "$CMDLINE_ZIP" -d /tmp/cmdline-tools-unpack
    rm -rf "${ANDROID_SDK_ROOT}/cmdline-tools/latest"
    mv /tmp/cmdline-tools-unpack/cmdline-tools "${ANDROID_SDK_ROOT}/cmdline-tools/latest"
    rm -f "$CMDLINE_ZIP"
  fi

  export ANDROID_SDK_ROOT
  export PATH="${ANDROID_SDK_ROOT}/cmdline-tools/latest/bin:${ANDROID_SDK_ROOT}/platform-tools:${PATH}"

  log "A aceitar licenças Android e instalar plataforma 35..."
  yes | sdkmanager --licenses >/dev/null || true
  sdkmanager \
    "platform-tools" \
    "platforms;android-35" \
    "build-tools;35.0.0"
fi

# ---------------------------------------------------------------------------
# 4. Variáveis de ambiente (~/.bashrc)
# ---------------------------------------------------------------------------
MARKER="# >>> flutter-vm >>>"
BLOCK="${MARKER}
export FLUTTER_HOME=\"${FLUTTER_HOME}\"
export ANDROID_SDK_ROOT=\"${ANDROID_SDK_ROOT}\"
export JAVA_HOME=\"\${JAVA_HOME:-/usr/lib/jvm/java-17-openjdk-amd64}\"
export PATH=\"\${FLUTTER_HOME}/bin:\${ANDROID_SDK_ROOT}/cmdline-tools/latest/bin:\${ANDROID_SDK_ROOT}/platform-tools:\${PATH}\"
${MARKER//>>>/<<<}"

if ! grep -qF "$MARKER" "$HOME/.bashrc" 2>/dev/null; then
  log "A acrescentar Flutter ao ~/.bashrc"
  {
    echo ""
    echo "$BLOCK"
  } >>"$HOME/.bashrc"
else
  log "~/.bashrc já contém bloco Flutter"
fi

# shellcheck source=/dev/null
export FLUTTER_HOME ANDROID_SDK_ROOT
export PATH="${FLUTTER_HOME}/bin:${ANDROID_SDK_ROOT}/cmdline-tools/latest/bin:${ANDROID_SDK_ROOT}/platform-tools:${PATH}"

# ---------------------------------------------------------------------------
# 5. Flutter config + precache
# ---------------------------------------------------------------------------
log "A configurar Flutter..."
flutter config --no-analytics 2>/dev/null || true
flutter config --android-sdk "$ANDROID_SDK_ROOT" 2>/dev/null || true
flutter precache --linux --android 2>/dev/null || flutter precache

log "A executar flutter doctor..."
flutter doctor -v

echo ""
log "Concluído. Abra um terminal novo ou execute: source ~/.bashrc"
echo ""
warn "O projeto em /media/sf_ScalWay/ (VirtualBox) NÃO suporta symlinks do Flutter."
echo "    Use cópia local:  mkdir -p ~/dev && rsync -a --exclude node_modules --exclude .dart_tool --exclude build /media/sf_ScalWay/skalway-pharm/ ~/dev/skalway-pharm/"
echo "    Depois:           cd ~/dev/skalway-pharm/pharma_erp && flutter pub get"
echo ""
echo "    Ver: docs/flutter-vm-setup.md"
