import os
import re
import logging
import sys
import subprocess
import tempfile
import shutil
from flask import Blueprint, request, jsonify, send_file
from werkzeug.utils import secure_filename
import serial.tools.list_ports


esp32_bp = Blueprint('esp32', __name__)

# Find esptool.py in the system's PATH. This is more robust.
ESPTOOL_PATH = shutil.which('esptool.py')
if ESPTOOL_PATH is None:
    logging.error("FATAL: 'esptool.py' not found in PATH. Please ensure it is installed and the virtual environment is activated.")
    # Set to a value that will cause a clear failure message.
    ESPTOOL_PATH = 'esptool.py_not_found_in_path'

def get_available_ports():
    """利用可能なシリアルポートのリストを取得"""
    ports = serial.tools.list_ports.comports()
    return [{"port": port.device, "description": port.description} for port in ports]

def run_esptool_command(command):
    """esptoolコマンドを実行し、結果を返す"""
    try:
        # 900秒（15分）のタイムアウトを設定。4MBのフラッシュを低速で読み出すには時間が必要。
        result = subprocess.run(command, shell=True, capture_output=True, text=True, timeout=900)
        return {
            "success": result.returncode == 0,
            "stdout": result.stdout,
            "stderr": result.stderr,
            "returncode": result.returncode
        }
    except subprocess.TimeoutExpired:
        logging.exception("esptool command timed out")
        return {
            "success": False,
            "stdout": "",
            "stderr": "Command timed out after 5 minutes",
            "returncode": -1
        }
    except Exception as e:
        logging.exception("An error occurred while running esptool command")
        return {
            "success": False,
            "stdout": "",
            "stderr": str(e),
            "returncode": -1
        }

@esp32_bp.route('/ports', methods=['GET'])
def list_ports():
    """利用可能なシリアルポートを一覧表示"""
    try:
        ports = get_available_ports()
        return jsonify({"success": True, "ports": ports})
    except Exception as e:
        logging.exception("Failed to list ports")
        return jsonify({"success": False, "error": str(e)}), 500

@esp32_bp.route('/backup', methods=['POST'])
def backup_flash():
    """ESP32フラッシュのバックアップを実行"""
    try:
        data = request.get_json()
        port = data.get('port')
        baud_rate = data.get('baud_rate', '115200')  # Default to a safe value

        if not port:
            return jsonify({"success": False, "error": "Port is required"}), 400

        # 一時ファイルを作成してバックアップを保存
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.bin')
        temp_file.close()

        # esptoolコマンドを構築
        command = f'"{sys.executable}" "{ESPTOOL_PATH}" --port "{port}" --baud {baud_rate} read_flash 0 ALL "{temp_file.name}"'

        # コマンドを実行
        result = run_esptool_command(command)

        if result["success"]:
            # ファイルサイズを取得
            file_size = os.path.getsize(temp_file.name)
            return jsonify({
                "success": True,
                "message": "Backup completed successfully",
                "file_path": temp_file.name.lstrip('/'),
                "file_size": file_size,
                "stdout": result["stdout"]
            })
        else:
            # 失敗した場合は一時ファイルを削除
            if os.path.exists(temp_file.name):
                os.unlink(temp_file.name)
            return jsonify({
                "success": False,
                "error": "Backup failed",
                "stderr": result["stderr"],
                "stdout": result["stdout"]
            }), 500

    except Exception as e:
        logging.exception("An error occurred during flash backup")
        # Attempt to clean up the temp file in case of an exception
        try:
            if 'temp_file' in locals() and os.path.exists(temp_file.name):
                os.unlink(temp_file.name)
        except Exception as cleanup_e:
            logging.error(f"Error during cleanup: {cleanup_e}")
        return jsonify({"success": False, "error": str(e)}), 500

@esp32_bp.route('/download/<path:file_path>')
def download_backup(file_path):
    """バックアップファイルをダウンロード"""
    try:
        # The path from the URL is missing the leading slash. Add it back.
        absolute_path = '/' + file_path
        if os.path.exists(absolute_path):
            logging.info(f"Downloading backup file from: {absolute_path}")
            return send_file(absolute_path, as_attachment=True, download_name='esp32_backup.bin')
        else:
            logging.error(f"Download failed: File not found at {absolute_path}")
            return jsonify({"success": False, "error": "File not found"}), 404
    except Exception as e:
        logging.exception("An error occurred during file download")
        return jsonify({"success": False, "error": str(e)}), 500

@esp32_bp.route('/restore', methods=['POST'])
def restore_flash():
    """ESP32フラッシュのリストアを実行"""
    try:
        port = request.form.get('port')
        baud_rate = request.form.get('baud_rate', '460800')
        address = request.form.get('address', '0x0')
        
        if not port:
            return jsonify({"success": False, "error": "Port is required"}), 400
        
        # アップロードされたファイルを確認
        if 'file' not in request.files:
            return jsonify({"success": False, "error": "No file uploaded"}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({"success": False, "error": "No file selected"}), 400
        
        # 一時ファイルに保存
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.bin')
        file.save(temp_file.name)
        temp_file.close()
        
        try:
            # esptoolコマンドを構築
            command = f"\"{sys.executable}\" \"{ESPTOOL_PATH}\" --port \"{port}\" --baud {str(baud_rate)} write_flash {address} \"{temp_file.name}\""
            
            # コマンドを実行
            result = run_esptool_command(command)
            
            if result["success"]:
                return jsonify({
                    "success": True,
                    "message": "Restore completed successfully",
                    "stdout": result["stdout"]
                })
            else:
                return jsonify({
                    "success": False,
                    "error": "Restore failed",
                    "stderr": result["stderr"],
                    "stdout": result["stdout"]
                }), 500
        finally:
            # 一時ファイルを削除
            if os.path.exists(temp_file.name):
                os.unlink(temp_file.name)
            
    except Exception as e:
        logging.exception("An error occurred during flash restore")
        return jsonify({"success": False, "error": str(e)}), 500

@esp32_bp.route('/erase', methods=['POST'])
def erase_flash():
    """ESP32フラッシュの消去を実行"""
    try:
        data = request.get_json()
        port = data.get('port')
        baud_rate = data.get('baud_rate', '460800')
        
        if not port:
            return jsonify({"success": False, "error": "Port is required"}), 400
        
        # esptoolコマンドを構築
        command = f"\"{sys.executable}\" \"{ESPTOOL_PATH}\" --port \"{port}\" --baud {str(baud_rate)} erase_flash"
        
        # コマンドを実行
        result = run_esptool_command(command)
        
        if result["success"]:
            return jsonify({
                "success": True,
                "message": "Flash erased successfully",
                "stdout": result["stdout"]
            })
        else:
            return jsonify({
                "success": False,
                "error": "Erase failed",
                "stderr": result["stderr"],
                "stdout": result["stdout"]
            }), 500
            
    except Exception as e:
        logging.exception("An error occurred during flash erase")
        return jsonify({"success": False, "error": str(e)}), 500

@esp32_bp.route('/chip_info', methods=['POST'])
def get_chip_info():
    """ESP32チップ情報を取得し、解析して返す"""
    try:
        data = request.get_json()
        port = data.get('port')
        baud_rate = data.get('baud_rate', '460800')

        if not port:
            return jsonify({"success": False, "error": "Port is required"}), 400

        chip_info = {}
        raw_outputs = []

        # --- 1. Get Chip Info (includes type, description, MAC) ---
        command_chip_id = f"\"{sys.executable}\" \"{ESPTOOL_PATH}\" --port \"{port}\" --baud {str(baud_rate)} chip_id"
        result_chip_id = run_esptool_command(command_chip_id)
        raw_outputs.append(f"--- chip_id ---\nstdout:\n{result_chip_id['stdout']}\nstderr:\n{result_chip_id['stderr']}")

        if result_chip_id['success']:
            output = result_chip_id['stdout']
            
            # Find all "Detecting chip type..." lines and use the last one
            matches = re.findall(r"Detecting chip type... (.+)", output)
            chip_info["chip_type"] = matches[-1].strip() if matches else "N/A"

            match = re.search(r"Chip is (.+)", output)
            chip_info["chip_description"] = match.group(1).strip() if match else "N/A"
            
            # Find all "MAC: ..." lines and use the last one, as esptool can print it multiple times
            mac_matches = re.findall(r"MAC: ([0-9a-fA-F:]+)", output)
            chip_info["mac_address"] = mac_matches[-1].strip() if mac_matches else "N/A"
        else:
            chip_info["chip_type"] = f"Error: {result_chip_id['stderr']}"
            chip_info["chip_description"] = "Error"
            chip_info["mac_address"] = "Error"

        # --- 2. Get Flash ID ---
        command_flash_id = f"\"{sys.executable}\" \"{ESPTOOL_PATH}\" --port \"{port}\" --baud {str(baud_rate)} flash_id"
        result_flash_id = run_esptool_command(command_flash_id)
        raw_outputs.append(f"--- flash_id ---\nstdout:\n{result_flash_id['stdout']}\nstderr:\n{result_flash_id['stderr']}")

        if result_flash_id['success']:
            output = result_flash_id['stdout']
            match = re.search(r"Manufacturer: (.+)", output)
            chip_info["flash_manufacturer"] = match.group(1).strip() if match else "N/A"
            match = re.search(r"Device: (.+)", output)
            chip_info["flash_device"] = match.group(1).strip() if match else "N/A"
        else:
            chip_info["flash_manufacturer"] = f"Error: {result_flash_id['stderr']}"
            chip_info["flash_device"] = "Error"

        # Combine raw outputs for debugging
        chip_info["raw_output"] = "\n\n".join(raw_outputs)

        return jsonify({"success": True, "chip_info": chip_info})

    except Exception as e:
        logging.exception("An error occurred while getting chip info")
        return jsonify({"success": False, "error": str(e)}), 500
