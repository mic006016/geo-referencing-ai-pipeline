# inference.py
import os
from ultralytics import YOLO
from PIL import Image

class GeoAIModel:
    def __init__(self):
        print("위성 이미지 객체 탐지용 YOLOv8 모델 로드 중...")
        # 전이 학습(Fine-tuning) 전 테스트를 위해 기본 가중치(COCO) 사용
        # AI HUB 토지피복지도로 학습 유무에 따라 커스텀 가중치 경로로 대체 가능
        self.model = YOLO("yolov8n.pt") 
        print("✅ YOLOv8 추론 엔진 준비 완료!")

    def detect_and_map(self, image_path: str, extent: dict):
        if not os.path.exists(image_path):
            return {"success": False, "error": "파일 없음"}

        try:
            # 1. 이미지 크기(원본 픽셀 해상도) 확인
            with Image.open(image_path) as img:
                img_w, img_h = img.size

            # 2. YOLOv8 추론 실행
            results = self.model(image_path)
            detected_objects = []

            # 타일의 지리적 크기 계산
            min_lon, max_lon = extent["minLon"], extent["maxLon"]
            min_lat, max_lat = extent["minLat"], extent["maxLat"]
            
            lon_range = max_lon - min_lon
            lat_range = max_lat - min_lat

            # 3. 탐지된 객체들의 픽셀 좌표를 위경도로 변환
            for box in results[0].boxes:
                # xywh -> 픽셀 중심점 (x, y) 및 가로세로 크기
                x_pixel, y_pixel, w_pixel, h_pixel = box.xywh[0].tolist()
                conf = float(box.conf[0].item())
                cls_id = int(box.cls[0].item())
                label = self.model.names[cls_id]

                # 💡 핵심: 픽셀 좌표 -> 실제 GIS 공간 좌표 변환 (Affine Mapping)
                # 경도(X축): 좌측(0)에서 우측(img_w)으로 갈수록 증가
                object_lon = min_lon + (x_pixel / img_w) * lon_range
                
                # 위도(Y축): 이미지 픽셀은 상단이 0이고 하단으로 갈수록 증가하지만, 
                # 실제 위도는 북쪽(상단, maxLat)이 높고 남쪽(하단, minLat)이 낮음
                object_lat = max_lat - (y_pixel / img_h) * lat_range

                detected_objects.append({
                    "objectType": label,
                    "confidence": round(conf, 4),
                    "longitude": round(object_lon, 6),
                    "latitude": round(object_lat, 6)
                })

            return {"success": True, "objects": detected_objects}

        except Exception as e:
            return {"success": False, "error": str(e)}

# 싱글톤 인스턴스 생성
geo_detector = GeoAIModel()