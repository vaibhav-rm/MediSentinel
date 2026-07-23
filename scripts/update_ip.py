#!/usr/bin/env python3
import os
import re
import socket

def get_lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # doesn't need to be reachable
        s.connect(('10.255.255.255', 1))
        ip = s.getsockname()[0]
    except Exception:
        ip = '127.0.0.1'
    finally:
        s.close()
    return ip

def update_cpp_firmware(ip):
    cpp_file = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'iot_devices', 'esp32_monitor', 'src', 'main.cpp'))
    if not os.path.exists(cpp_file):
        print(f"[!] main.cpp not found at: {cpp_file}")
        return False
    
    with open(cpp_file, 'r') as f:
        content = f.read()
    
    # Replace the mqtt_server variable
    pattern = r'(const char\*\s+mqtt_server\s*=\s*")[^"]+(";)'
    new_content, count = re.subn(pattern, rf'\g<1>{ip}\g<2>', content)
    
    if count > 0:
        with open(cpp_file, 'w') as f:
            f.write(new_content)
        print(f"[+] Updated mqtt_server to {ip} in main.cpp")
        return True
    else:
        print("[!] Could not find mqtt_server definition in main.cpp")
        return False

def update_env(ip):
    env_file = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '.env'))
    if not os.path.exists(env_file):
        print(f"[!] .env file not found at: {env_file}")
        return False
        
    with open(env_file, 'r') as f:
        lines = f.readlines()
        
    updated = False
    new_line = f"OTA_BASE_URL=http://{ip}:8000\n"
    
    for i, line in enumerate(lines):
        if line.startswith('OTA_BASE_URL='):
            lines[i] = new_line
            updated = True
            break
            
    if not updated:
        # Append to the end
        if lines and not lines[-1].endswith('\n'):
            lines.append('\n')
        lines.append(new_line)
        
    with open(env_file, 'w') as f:
        f.writelines(lines)
        
    print(f"[+] Updated OTA_BASE_URL to http://{ip}:8000 in .env")
    return True

if __name__ == '__main__':
    ip = get_lan_ip()
    print(f"[*] Detected Host LAN IP: {ip}")
    update_cpp_firmware(ip)
    update_env(ip)
