## 🛰️ Geo-AI: 비동기 메시지 큐 기반 공간 객체 탐지 및 매핑 파이프라인
> 대용량 항공/위성 이미지와 공간 메타데이터를 활용하여 지표면의 객체(건물, 도로, 논, 밭 등)를 탐지하고, 이를 실세계 지리 좌표로 변환하여 지도 위에 매핑하는 **End-to-End(E2E) Geo-AI 웹 서비스**입니다. 데이터 중심(Data-Centric)의 가설 검증으로 탐지 모델을 고도화하였으며, AI 추론의 병목 현상을 방지하기 위해 Redis 기반의 비동기 메시지 큐 아키텍처를 도입하여 대규모 트래픽 환경에서도 안정적인 서버 응답성을 확보했습니다.

🎥 **기능 구현**

https://github.com/user-attachments/assets/e2839254-2979-4493-9fc4-5b2bc577cf07

---

### 🌟 핵심 아키텍처 (Microservice Architecture)

시스템의 확장성과 대용량 데이터 처리의 안정성을 극대화하기 위해 **Node.js(메인) - Redis(큐) - Python(AI 워커)** 형태의 분산 처리 시스템으로 설계되었습니다.

1. **Node.js (API Server):** 이미지 업로드 수신, 공간 메타데이터 파싱, 비동기 작업 큐잉, 공간 DB 적재 및 클라이언트 응답.
2. **Redis (Message Queue):** 대규모 분석 요청에 대한 트래픽 완충 및 백그라운드 작업 대기열(List) 관리.
3. **Python Worker (AI Inference):** 큐 감시(Blpop), YOLOv8 기반 공간 객체 탐지 및 아핀 변환(Affine Transform) 독립 수행.

### 🔥 담당 업무 및 핵심 기여 (My Contributions)

공간 데이터의 전처리부터 AI 모델 최적화, 그리고 비동기 백엔드 파이프라인 구축까지 전체 시스템의 흐름을 주도했습니다.

#### 1. AI & Data Engineering (데이터 중심 모델 최적화)
- **공간 데이터 정규화:** 메타데이터의 절대 픽셀 좌표를 모델 학습 규격인 상대 좌표(0~1)로 자동 정규화하는 파이프라인 구축.
- **오류 원인 규명:** 혼동 행렬(Confusion Matrix)과 Feature Map 분석을 통해, 모델이 지형의 '형태(고랑)'를 보지 못하고 단순 '색상(어두운 흙)'에 과적합되어 밭(Field)을 논(RicePaddy)으로 오분류하고 있음을 통계적으로 규명.
- **가설 검증 및 성능 극대화 (A/B Test):** 입력 해상도를 한계치까지 상향(512 ➔ 1024)하여 물리적으로 손실되던 밭고랑의 픽셀 특징을 복원. 밭 클래스의 재현율을 3%p 높이고 전체 mAP50 수치를 86.4%로 끌어올리며 모델 최적화 달성.

#### 2. Backend Engineering (비동기 처리 & 공간 DB)
- **생산자-소비자(Producer-Consumer) 패턴 도입:** 무거운 AI 추론 작업을 백그라운드 Python Worker로 격리하여, 대규모 이미지 업로드 시 발생하는 Node.js 메인 서버의 Event Loop 블로킹 현상 100% 해결.
- **공간 DB 인덱스(R-Tree) 고속화:** MySQL 8.0 GEOMETRY 타입을 활용해 공간 데이터베이스 구축. SRID 충돌(Error 3033) 문제를 쿼리 단에서 평면 좌표계(SRID 0)로 일치시켜 해결함으로써 ST_Within 내장 함수를 활용한 BBox 영역 고속 검색 구현.

#### 3. Frontend Engineering (Geo-Spatial UI)
- **실시간 투영 변환:** Proj4js를 활용하여 원본 데이터의 국가표준좌표(EPSG:5186)를 브라우저단에서 WGS84(EPSG:4326) 글로벌 좌표계로 실시간 변환.
- **인터랙티브 렌더링:** 사용자의 파일 업로드 즉시 Leaflet.js를 통해 실제 촬영 위치로 지도가 이동하며, AI 탐지 객체를 GeoJSON 다각형(Polygon) 형태로 렌더링.

### 🔄 핵심 데이터 흐름 (Data Flow & Pipeline)

대용량 이미지 업로드부터 지도 표출까지의 파이프라인은 병목 없이 유기적으로 동작합니다.
1. **Request:** 사용자가 화면에서 위성 이미지와 메타데이터 업로드 (클라이언트에서 좌표계 1차 투영 변환 수행).
2. **Queueing:** 메인 API 서버는 이미지를 적재한 후 Redis 큐에 분석 Task를 Push하고 사용자에게 202(Accepted) 즉시 응답.
3. **AI Inference:** 백그라운드 Python 워커가 큐에서 작업을 인계받아 객체 탐지 후, 픽셀 좌표를 실제 지구 위경도로 변환(Affine Mapping).
4. **DB Bulk Insert:** 분석이 완료된 GeoJSON 형태의 공간 데이터를 API 서버로 전달하여 MySQL에 일괄 적재.
5. **Rendering:** 사용자가 지도를 이동할 때마다, 현재 화면 BBox 범위 내의 객체만 R-Tree 공간 인덱스로 순식간에 검색하여 표출.

### 🛠 Tech Stack
- Frontend
  - HTML/CSS/JS, Leaflet.js, Proj4js
- Backend (Microservices)
  - Main Server: Node.js, Express, Sequelize ORM
  - AI Server: Python, YOLOv8, OpenCV, Pillow(PIL)
- Database & Message Broker
  - MySQL 8.0 (Spatial Database)
  - Redis
