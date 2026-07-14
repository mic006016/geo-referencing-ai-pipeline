const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const redis = require("redis");

module.exports = (sequelize) => {
  const { SatelliteTask } = sequelize.models;

  // 1. Redis 클라이언트 설정 및 연결
  const redisClient = redis.createClient({
    url: `redis://${process.env.REDIS_HOST || "127.0.0.1"}:${process.env.REDIS_PORT || 6379}`,
  });

  redisClient
    .connect()
    .then(() => console.log("✅ Redis 대기열 큐 연결 성공!"))
    .catch((err) => console.error("❌ Redis 연결 실패:", err));

  // 2. Multer 저장소 설정
  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, "uploads/"),
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(
        null,
        file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname),
      );
    },
  });

  const upload = multer({ storage: storage });

  // 3. 이미지 업로드 API (BBox 데이터 수신 -> DB 저장 -> Redis 푸시)
  router.post("/upload", upload.single("image"), async (req, res) => {
    try {
      if (!req.file) {
        return res
          .status(400)
          .json({ success: false, message: "업로드된 파일이 없습니다." });
      }

      const taskId = crypto.randomUUID();
      const filePath = req.file.path;

      // 프론트엔드에서 보낸 바운딩 박스(BBox) 좌표 수신
      const { minLon, minLat, maxLon, maxLat } = req.body;

      if (!minLon || !minLat || !maxLon || !maxLat) {
        return res
          .status(400)
          .json({
            success: false,
            message: "공간 메타데이터(BBox)가 누락되었습니다.",
          });
      }

      // MySQL 공간 데이터 규격으로 Polygon 생성
      const tilePolygon = {
        type: "Polygon",
        coordinates: [
          [
            [parseFloat(minLon), parseFloat(minLat)],
            [parseFloat(minLon), parseFloat(maxLat)],
            [parseFloat(maxLon), parseFloat(maxLat)],
            [parseFloat(maxLon), parseFloat(minLat)],
            [parseFloat(minLon), parseFloat(minLat)],
          ],
        ],
      };

      // 부모 테이블(SatelliteTask)에 업로드 이력 기록
      await SatelliteTask.create({
        taskId: taskId,
        imagePath: filePath,
        tileBounds: tilePolygon,
        status: "QUEUED",
      });

      // 파이썬 워커가 좌표 변환(Affine Transform)을 할 수 있도록 BBox 정보 동봉
      const taskPayload = {
        taskId: taskId,
        imagePath: filePath,
        extent: {
          minLon: parseFloat(minLon),
          minLat: parseFloat(minLat),
          maxLon: parseFloat(maxLon),
          maxLat: parseFloat(maxLat),
        },
      };

      // Redis 'image_queue'에 Task 푸시
      await redisClient.lPush("image_queue", JSON.stringify(taskPayload));

      return res
        .status(202)
        .json({ success: true, taskId: taskId, message: "대기열 등록 완료" });
    } catch (error) {
      console.error("❌ 이미지 업로드 파이프라인 에러:", error);
      return res
        .status(500)
        .json({
          success: false,
          message: "서버 내부 오류",
          error: error.message,
        });
    }
  });

  return router;
};
