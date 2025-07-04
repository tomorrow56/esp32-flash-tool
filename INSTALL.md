# ESP32 Flash Tool インストールガイド

## システム要件

- Python 3.7以上
- pip（Pythonパッケージマネージャー）
- ESP32デバイス
- USBケーブル（データ転送対応）

## インストール手順

### Windows

#### 1. Pythonのインストール
1. [Python公式サイト](https://www.python.org/downloads/)からPython 3.7以上をダウンロード
2. インストーラーを実行し、「Add Python to PATH」にチェックを入れる
3. インストールを完了

#### 2. ESP32ドライバーのインストール
1. ESP32のUSBシリアルチップに応じたドライバーをインストール：
   - CP2102: [Silicon Labs CP210x ドライバー](https://www.silabs.com/developers/usb-to-uart-bridge-vcp-drivers)
   - CH340: [CH340 ドライバー](http://www.wch.cn/downloads/CH341SER_EXE.html)

#### 3. アプリケーションのセットアップ
```cmd
cd esp32-flash-tool
venv\\Scripts\\activate
pip install -r requirements.txt
```

### macOS

#### 1. Pythonのインストール
```bash
# Homebrewを使用する場合
brew install python

# または公式サイトからダウンロード
```

#### 2. ESP32ドライバーのインストール
```bash
# CP2102ドライバー（必要に応じて）
# Silicon Labsの公式サイトからダウンロード

# CH340ドライバー（必要に応じて）
# WCHの公式サイトからダウンロード
```

#### 3. 仮想環境の作成とアクティベート
```bash
python3 -m venv venv
source venv/bin/activate
```

#### 4. 依存関係のインストール
```bash
pip install -r requirements.txt
```

### Linux (Ubuntu/Debian)

#### 1. Pythonのインストール
```bash
sudo apt update
sudo apt install python3 python3-pip python3-venv
```

#### 2. ユーザー権限の設定
```bash
# シリアルポートへのアクセス権限を付与
sudo usermod -a -G dialout $USER

# ログアウト・ログインして権限を反映
```

#### 3. 仮想環境の作成とアクティベート
```bash
python3 -m venv venv
source venv/bin/activate
```

#### 4. 依存関係のインストール
```bash
pip install -r requirements.txt
```

## 動作確認

### 1. アプリケーションの起動
```bash
# 仮想環境をアクティベート
source venv/bin/activate  # Linux/Mac
# または
venv\\Scripts\\activate  # Windows

# アプリケーション起動
python src/main.py
```

### 2. ブラウザでアクセス
`http://localhost:5000` にアクセスして、アプリケーションが正常に表示されることを確認

### 3. ESP32の接続確認
1. ESP32をUSBで接続
2. 「更新」ボタンをクリック
3. シリアルポートのドロップダウンにESP32のポートが表示されることを確認

## トラブルシューティング

### Pythonが見つからない場合
```bash
# Pythonのバージョン確認
python --version
python3 --version

# pipのバージョン確認
pip --version
pip3 --version
```

### 仮想環境の作成に失敗する場合
```bash
# 仮想環境を手動で作成
python -m venv venv

# または
python3 -m venv venv
```

### パッケージのインストールに失敗する場合
```bash
# pipをアップグレード
pip install --upgrade pip

# 個別にパッケージをインストール
pip install flask flask-cors pyserial esptool
```

### シリアルポートが表示されない場合（Linux）
```bash
# ユーザーがdialoutグループに属しているか確認
groups $USER

# dialoutが表示されない場合
sudo usermod -a -G dialout $USER
# ログアウト・ログインが必要
```

### ESP32が認識されない場合
1. USBケーブルがデータ転送対応であることを確認
2. ESP32のドライバーが正しくインストールされているか確認
3. デバイスマネージャー（Windows）またはdmesg（Linux）でデバイスの認識状況を確認

### ポート権限エラー（Linux/Mac）
```bash
# 一時的な解決方法
sudo chmod 666 /dev/ttyUSB0  # ポート名は環境に応じて変更

# 恒久的な解決方法
sudo usermod -a -G dialout $USER
```

## 開発環境のセットアップ

開発者向けの追加セットアップ：

```bash
# 開発用パッケージのインストール
pip install -r requirements-dev.txt

# コードフォーマッター
pip install black flake8

# テストフレームワーク
pip install pytest
```

## アンインストール

```bash
# 仮想環境を削除
rm -rf venv  # Linux/Mac
rmdir /s venv  # Windows

# プロジェクトディレクトリを削除
cd ..
rm -rf esp32-flash-tool  # Linux/Mac
rmdir /s esp32-flash-tool  # Windows
```

