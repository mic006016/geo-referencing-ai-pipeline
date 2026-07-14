# 🛰️ Geo-AI: 비동기 메시지 큐 기반 공간 객체 탐지 및 매핑 파이프라인



## 🚀 프로젝트 소개

대용량 항공/위성 이미지와 공간 메타데이터를 활용하여 지표면의 객체(건물, 도로, 논, 밭 등)를 탐지하고, 이를 실세계 지리 좌표로 변환하여 지도 위에 매핑하는 **End-to-End(E2E) Geo-AI 웹 서비스**입니다. AI 추론의 병목 현상을 방지하기 위해 Redis 기반의 비동기 메시지 큐 아키텍처를 도입하여 대규모 트래픽 환경에서도 안정적인 서버 응답성을 확보했습니다.

## 🛠️ 기술 스택

- **Frontend:** HTML/CSS/JS, Leaflet.js (지도 시각화), Proj4js (실시간 좌표계 투영 변환)
- **Backend API:** Node.js, Express, Sequelize ORM
- **Message Broker:** Redis (비동기 작업 대기열 관리)
- **AI Worker:** Python, YOLOv8, Rasterio
- **Database:** MySQL 8.0 (Spatial Database, SRID 4326, R-Tree Index)

## ⚙️ 시스템 아키텍처 (워크플로우)

1. **데이터 수집 및 투영 변환 (Client):** 사용자가 위성 이미지(.jpg)와 공간 메타데이터(.json)를 업로드. Client에서 `Proj4js`를 사용해 EPSG:5186(국가표준) 좌표를 EPSG:4326(WGS84)으로 변환 후 서버로 전송.
2. **비동기 큐잉 (Node.js & Redis):** Express 서버는 이미지를 로컬 스토리지에 저장하고, 분석 작업을 Redis 대기열(Queue)에 Push하여 즉각적인 HTTP 응답 반환.
3. **분산 AI 연산 (Python Worker):** 백그라운드 파이썬 워커가 Redis 큐를 모니터링(Blpop)하다가 작업을 수신. YOLOv8을 통해 이미지 내 객체의 픽셀 BBox를 추출하고, 이를 아핀 변환(Affine Transform)하여 실제 위경도 공간 좌표로 치환.
4. **공간 데이터베이스 적재 (MySQL):** 분석 완료된 공간 객체 데이터를 MySQL Spatial Table에 저장.
5. **실시간 렌더링 (Client):** 사용자의 화면 BBox를 기준으로 DB에 공간 쿼리(`ST_Within`)를 요청하여 렌더링.

## 💡 핵심 트러블슈팅 및 문제 해결

### 1. 대용량 AI 분석으로 인한 메인 서버 병목 현상 해결

- **문제:** 단일 Node.js 서버에서 무거운 이미지 AI 연산을 직접 처리할 경우, Event Loop가 블로킹되어 다른 사용자의 API 요청을 처리하지 못하는 문제 발생.
- **해결:** Redis의 `List` 자료구조를 활용한 **생산자-소비자(Producer-Consumer) 패턴** 도입. Node.js는 작업만 던지고 빠지며, 분리된 Python Worker가 백그라운드에서 AI 연산을 전담하도록 마이크로서비스 아키텍처(MSA) 형태로 분리하여 서버 가용성 100% 확보.

### 2. 데이터 중심(Data-Centric) 접근을 통한 탐지 성능 극대화

- **문제:** 초기 모델 학습 시 기대 목표치만큼의 mAP(평균 정밀도)가 나오지 않음.
- **해결:** 모델 아키텍처 튜닝에 집중하는 대신, 노이즈가 낀 라벨링 데이터를 직접 검수하고 오답을 정제하는 **데이터 중심(Data-Centric)** 접근 방식을 채택. 깔끔한 Ground Truth를 확보하여 탐지 정확도를 비약적으로 향상시킴.

### 3. 실세계 투영을 위한 공간 데이터 매핑 (Proj4js & Affine Transform)

- **문제:** YOLOv8 모델은 이미지 내의 '픽셀 좌표(x, y)'만 반환하므로, 이를 실제 지도에 띄울 수 없음.
- **해결:** 프론트엔드에서 원본 데이터의 메타데이터(JSON)를 파싱 후 `Proj4js`로 실시간 좌표 변환을 수행하여 BBox 획득. 파이썬 워커는 이 BBox를 받아 객체의 픽셀 위치를 실제 지구 상의 위경도로 역산(아핀 변환)하는 로직을 구현함.

### 4. MySQL 8.0 공간 DB SRID 충돌(Error 3033) 해결

- **문제:** `ST_Within` 함수를 사용해 지도 화면 내의 객체를 검색할 때, `Different SRIDs: 0 and 4326` 에러 발생.
- **해결:** MySQL 8.0의 엄격해진 공간 참조 시스템(SRS) 정책을 파악하고, DB에 저장된 평면 좌표(SRID 0) 규격에 맞추어 `ST_GeomFromText` 함수의 X, Y(Lon, Lat) 순서와 SRID 파라미터를 0으로 일치시켜 R-Tree 공간 인덱스 기반의 고속 검색을 구현함.
