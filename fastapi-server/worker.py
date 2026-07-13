import os
import json
import time
import redis
import requests
from dotenv import load_dotenv
from inference import geo_detector

# 환경 변수 로드
load_dotenv()

REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 16379))

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def start_worker():
    # 1. Redis 연결 설정
    try:
        r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=0, decode_responses=True)
        print(f"✅ Redis 큐에 연결! ({REDIS_HOST}:{REDIS_PORT})")
    except Exception as e:
        print(f"❌ Redis 연결 실패: {e}")
        return

    print("🚀 'image_queue' 대기열 감시 시작...")

    # 2. 무한 루프로 큐 감시 (Blocking 팝 활용)
    while True:
        try:
            # blpop은 데이터가 들어올 때까지 프로세스를 대기(Block) 
            # 소켓 타임아웃 방지를 위해 10초 주기로 대기 (timeout=0은 무한 대기)
            task_data = r.blpop("image_queue", timeout=10)
            
            if task_data:
                queue_name, payload_str = task_data
                payload = json.loads(payload_str)
                
                task_id = payload.get("taskId")
                relative_image_path = payload.get("imagePath")
                lat = payload.get("latitude")
                lon = payload.get("longitude")
                
                print("\n==================================================")
                print(f"[Queue Pop] 새로운 작업 수신 완료! Task ID: {task_id}")
                print(f"지리 좌표 추출값: 위도 {lat}, 경도 {lon}")
                
                # Node.js 서버가 저장한 실제 이미지 파일 절대 경로 계산
                absolute_image_path = os.path.join(BASE_DIR, "express-server", relative_image_path)
                print(f"이미지 경로: {absolute_image_path}")
                print("==================================================")
                               
                
                # 3. [AI 모델 추론구간] YOLOv8 연산 개시
                def process_task(payload_str):
                  try:
                      task_data = json.loads(payload_str)
                      task_id = task_data["taskId"]
                      image_path = task_data["imagePath"]
                      extent = task_data["extent"] # Node.js가 넘겨준 공간 메타데이터

                      print(f"[Task 팝] 분석 시작. ID: {task_id}")
                      
                      # AI 분석 및 GIS 좌표 변환 동시 수행
                      result = geo_detector.detect_and_map(image_path, extent)

                      if result["success"]:
                          # Express 서버로 넘겨줄 최종 정제 데이터
                          result_payload = {
                              "taskId": task_id,
                              "status": "COMPLETED",
                              "detectedObjects": result["objects"] # 변환된 위경도가 포함된 리스트
                          }
                      else:
                          result_payload = {"taskId": task_id, "status": "FAILED", "detectedObjects": []}

                      # Express API 서버의 결과 저장 엔드포인트로 전송
                      response = requests.post("http://localhost:3000/api/results/save", json=result_payload)
                      if response.status_code == 200:
                          print(f"✅ [Task 완료] {len(result['objects'])}개 객체 공간 매핑 및 전송 성공!")

                  except Exception as e:
                      print(f"❌ 워커 처리 중 치명적 오류: {e}")

        except redis.ConnectionError:
            print("❌ Redis 서버와의 연결이 끊어졌습니다. 5초 후 재시도합니다...")
            time.sleep(5)
        except Exception as e:
            print(f"⚠️ 워커 루프 중 예외 발생: {e}")
            time.sleep(1)

if __name__ == "__main__":
    start_worker()