# Flutter na VM (Zorin OS)

SDK descompactado em: `/media/sf_ScalWay/flutter` (Flutter **3.35.7**, Dart **3.9.2**).

## Configuração rápida

Num terminal, na raiz do repositório:

```bash
bash scripts/setup-flutter-vm.sh
```

O script (com **sudo**):

1. Cria symlink `~/flutter-sdk` → `/media/sf_ScalWay/flutter`
2. Instala `clang`, `cmake`, `ninja-build`, `pkg-config`, GTK, Java 17
3. Instala Android SDK em `~/Android/Sdk` (opcional, `INSTALL_ANDROID=0` para omitir)
4. Actualiza `~/.bashrc` com `PATH` e `ANDROID_SDK_ROOT`
5. Executa `flutter doctor -v`

Depois:

```bash
source ~/.bashrc
flutter doctor
```

## Já configurado sem sudo

| Item | Localização |
|------|-------------|
| Symlink SDK | `~/flutter-sdk` → `/media/sf_ScalWay/flutter` |
| PATH | `~/.bashrc.d/flutter.sh` (carregado em `~/.bashrc`) |
| Projeto ERP | `pharma_erp/` (Dart SDK `^3.9.2`, compatível) |

## Importante: pasta partilhada VirtualBox

O repositório em `/media/sf_ScalWay/` (**vboxsf**) **não suporta symlinks**. O Flutter falha em `pub get` / build com:

```text
PathAccessException: Cannot create link ... Operation not permitted
```

### Opção A — Cópia de trabalho no disco local (recomendado)

```bash
mkdir -p ~/dev
rsync -a --delete \
  --exclude node_modules --exclude .dart_tool --exclude build \
  /media/sf_ScalWay/skalway-pharm/ ~/dev/skalway-pharm/

cd ~/dev/skalway-pharm/pharma_erp
flutter pub get
flutter run -d chrome    # ou linux, após instalar dependências
```

Sincronizar alterações de volta para a pasta partilhada quando quiser:

```bash
rsync -a ~/dev/skalway-pharm/pharma_erp/ /media/sf_ScalWay/skalway-pharm/pharma_erp/
```

### Opção B — Activar symlinks na pasta partilhada

No **host** (máquina que corre VirtualBox), com a VM desligada:

```bash
VBoxManage setextradata "NOME_DA_VM" VBoxInternal2/SharedFoldersEnableSymlinksCreate/sf_ScalWay 1
```

Reiniciar a VM e remontar a partilha (ou reiniciar guest). Nem sempre funciona em todos os hosts.

### Opção C — Só desenvolvimento Web

Em alguns casos `flutter run -d chrome` a partir de `~/dev/...` após `pub get` local é suficiente.

## Comandos úteis

```bash
# Versão
flutter --version

# Dependências do app
cd ~/dev/skalway-pharm/pharma_erp && flutter pub get

# Dispositivos
flutter devices

# Web
flutter run -d chrome

# Linux desktop (requer clang/cmake/ninja)
flutter run -d linux

# Android (após setup-flutter-vm.sh)
flutter run -d android
```

## Cursor / VS Code

Definir o SDK (opcional, em `settings.json`):

```json
{
  "dart.flutterSdkPath": "/home/momade/flutter-sdk"
}
```

## Estado típico do `flutter doctor`

| Componente | Após `setup-flutter-vm.sh` |
|------------|----------------------------|
| Flutter | OK |
| Chrome / Web | OK |
| Linux desktop | OK (com apt packages) |
| Android | OK (com SDK em `~/Android/Sdk`) |
| Android Studio | Opcional (não obrigatório) |

Sem correr o script: Flutter e Chrome funcionam; faltam **clang/cmake** (Linux) e **Android SDK** (mobile).
