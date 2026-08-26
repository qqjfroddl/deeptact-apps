import json
import os
import random
import smtplib
import ssl
import sys
import time
from email.message import EmailMessage
from pathlib import Path

import requests
import pyautogui
import pyperclip
from pywinauto import Desktop

BASE_DIR = Path(__file__).resolve().parent
CONFIG_PATH = BASE_DIR / "agent_config.json"

DEFAULT_CONFIG = {
    "server_url": "https://deeptact-apps.vercel.app",
    "agent_key": "",
    "poll_interval_sec": 8,
    "naver_email": "",
    "naver_app_password": "",
    "smtp_host": "smtp.naver.com",
    "smtp_port": 465,
    "kakao_window_title_regex": ".*카카오톡.*",
    "individual_delay_min_sec": 2.5,
    "individual_delay_max_sec": 5.0,
    "group_break_min_sec": 30,
    "group_break_max_sec": 60,
    "fallback_positions": {
        "friend_tab": None,
        "search_box": None,
        "first_result": None,
        "message_box": None
    }
}


def load_config():
    cfg = json.loads(json.dumps(DEFAULT_CONFIG))
    if CONFIG_PATH.exists():
        data = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
        for k, v in data.items():
            if isinstance(v, dict) and isinstance(cfg.get(k), dict):
                cfg[k].update(v)
            else:
                cfg[k] = v
    return cfg


class ApiClient:
    def __init__(self, cfg):
        self.base = cfg["server_url"].rstrip("/")
        self.headers = {"x-morning-agent-key": cfg["agent_key"], "Content-Type": "application/json"}

    def claim(self):
        r = requests.get(f"{self.base}/api/morning-sender/agent", headers=self.headers, timeout=30)
        r.raise_for_status()
        return r.json()

    def update(self, job_id, **payload):
        body = {"job_id": job_id, **payload}
        r = requests.patch(f"{self.base}/api/morning-sender/agent", headers=self.headers, json=body, timeout=30)
        r.raise_for_status()
        return r.json()


class KakaoDriver:
    """UI Automation first, calibrated coordinate fallback second."""

    def __init__(self, cfg):
        self.cfg = cfg
        self.positions = cfg.get("fallback_positions", {})

    def _window(self):
        wins = Desktop(backend="uia").windows(title_re=self.cfg["kakao_window_title_regex"], visible_only=True)
        if not wins:
            raise RuntimeError("PC 카카오톡 창을 찾지 못했습니다. 로그인 후 메인 창을 열어 주세요.")
        return wins[0]

    def _uia_search_box(self, win):
        edits = win.descendants(control_type="Edit")
        if not edits:
            return None
        # Prefer an edit whose accessible name hints search; otherwise first visible edit.
        for e in edits:
            try:
                name = (e.window_text() or "").lower()
                if "검색" in name or "search" in name:
                    return e
            except Exception:
                pass
        return edits[0]

    def send(self, name, message):
        try:
            self._send_uia(name, message)
            return "uia"
        except Exception:
            self._send_fallback(name, message)
            return "fallback"

    def _send_uia(self, name, message):
        win = self._window()
        win.set_focus()
        time.sleep(0.5)
        search = self._uia_search_box(win)
        if not search:
            raise RuntimeError("카카오톡 검색 컨트롤을 UI Automation으로 찾지 못했습니다.")
        search.set_focus()
        pyautogui.hotkey("ctrl", "a")
        pyperclip.copy(name)
        pyautogui.hotkey("ctrl", "v")
        time.sleep(1.0)

        # Custom Kakao controls may not expose contact rows reliably; use keyboard selection.
        pyautogui.press("down")
        pyautogui.press("enter")
        time.sleep(1.0)

        pyperclip.copy(message)
        pyautogui.hotkey("ctrl", "v")
        time.sleep(0.2)
        pyautogui.press("enter")
        time.sleep(0.5)
        pyautogui.hotkey("alt", "f4")
        time.sleep(0.7)

    def _send_fallback(self, name, message):
        needed = ["friend_tab", "search_box", "first_result", "message_box"]
        if any(not self.positions.get(k) for k in needed):
            raise RuntimeError("UI Automation 실패 및 fallback 좌표 미설정")
        p = self.positions
        pyautogui.click(*p["friend_tab"]); time.sleep(.7)
        pyautogui.click(*p["search_box"]); pyautogui.hotkey("ctrl", "a")
        pyperclip.copy(name); pyautogui.hotkey("ctrl", "v"); time.sleep(1.0)
        pyautogui.doubleClick(*p["first_result"], interval=.15); time.sleep(1.0)
        pyautogui.click(*p["message_box"]); pyperclip.copy(message); pyautogui.hotkey("ctrl", "v"); time.sleep(.2)
        pyautogui.press("enter"); time.sleep(.5)
        pyautogui.hotkey("alt", "f4"); time.sleep(.7)
        pyautogui.click(*p["search_box"]); pyautogui.hotkey("ctrl", "a"); pyautogui.press("backspace")


class Mailer:
    def __init__(self, cfg):
        self.cfg = cfg

    def send_many(self, subject, message, recipients, callback):
        if not self.cfg["naver_email"] or not self.cfg["naver_app_password"]:
            raise RuntimeError("agent_config.json에 naver_email / naver_app_password를 설정해 주세요.")
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(self.cfg["smtp_host"], int(self.cfg["smtp_port"]), context=context, timeout=30) as server:
            server.login(self.cfg["naver_email"], self.cfg["naver_app_password"])
            for r in recipients:
                try:
                    msg = EmailMessage()
                    msg["From"] = self.cfg["naver_email"]
                    msg["To"] = r["email"]
                    msg["Subject"] = subject
                    msg.set_content(message)
                    server.send_message(msg)
                    callback(r, True, "")
                except Exception as e:
                    callback(r, False, str(e))
                time.sleep(0.5)


def process_job(api, cfg, payload):
    job = payload["job"]
    recipients = payload.get("recipients", [])
    logs = []
    sk = fk = se = fe = 0
    driver = KakaoDriver(cfg)

    try:
        if job.get("send_kakao"):
            groups = {}
            allowed = set(int(x) for x in (job.get("kakao_groups") or []))
            for r in recipients:
                if r.get("kakao_enabled") and r.get("kakao_name") and (not allowed or int(r.get("kakao_group") or 0) in allowed):
                    groups.setdefault(int(r.get("kakao_group") or 1), []).append(r)

            ordered = sorted(groups)
            for gi, group_no in enumerate(ordered):
                rows = groups[group_no]
                for i, r in enumerate(rows):
                    try:
                        mode = driver.send(r["kakao_name"], job["message"])
                        sk += 1
                        logs.append({"channel":"kakao","recipient_name":r["name"],"address":r["kakao_name"],"kakao_group":group_no,"status":"success","detail":mode})
                    except Exception as e:
                        fk += 1
                        logs.append({"channel":"kakao","recipient_name":r["name"],"address":r["kakao_name"],"kakao_group":group_no,"status":"failed","detail":str(e)})
                    api.update(job["id"], success_kakao=sk, failed_kakao=fk)
                    if i < len(rows)-1:
                        time.sleep(random.uniform(cfg["individual_delay_min_sec"], cfg["individual_delay_max_sec"]))
                if gi < len(ordered)-1:
                    time.sleep(random.randint(cfg["group_break_min_sec"], cfg["group_break_max_sec"]))

        if job.get("send_email"):
            mail_rows = [r for r in recipients if r.get("email_enabled") and r.get("email")]
            mailer = Mailer(cfg)
            def cb(r, ok, detail):
                nonlocal se, fe
                if ok: se += 1
                else: fe += 1
                logs.append({"channel":"email","recipient_name":r["name"],"address":r["email"],"kakao_group":r.get("kakao_group"),"status":"success" if ok else "failed","detail":detail})
                api.update(job["id"], success_email=se, failed_email=fe)
            mailer.send_many(job.get("subject") or job["content_type"], job["message"], mail_rows, cb)

        api.update(job["id"], status="completed", success_kakao=sk, failed_kakao=fk, success_email=se, failed_email=fe, logs=logs)
        print(f"완료: 카톡 {sk} 성공/{fk} 실패, 메일 {se} 성공/{fe} 실패")
    except Exception as e:
        api.update(job["id"], status="failed", success_kakao=sk, failed_kakao=fk, success_email=se, failed_email=fe, last_error=str(e), logs=logs)
        print("작업 실패:", e)


def validate(cfg):
    if not cfg.get("agent_key"):
        raise RuntimeError("agent_config.json의 agent_key가 비어 있습니다.")


def main():
    cfg = load_config()
    validate(cfg)
    api = ApiClient(cfg)
    print("Morning Sender Agent V4 시작")
    print("서버:", cfg["server_url"])
    while True:
        try:
            payload = api.claim()
            if payload.get("job"):
                print("작업 수신:", payload["job"]["id"], payload["job"]["content_type"])
                process_job(api, cfg, payload)
            else:
                time.sleep(cfg["poll_interval_sec"])
        except KeyboardInterrupt:
            print("종료")
            break
        except Exception as e:
            print("에이전트 오류:", e)
            time.sleep(max(10, cfg["poll_interval_sec"]))


if __name__ == "__main__":
    main()
