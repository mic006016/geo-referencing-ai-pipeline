const express = require("express");
const router = express.Router();
const crypto = require("crypto");

module.exports = (sequelize) => {
  const { SatelliteTask } = sequelize.models;

  router.post("/upload", async (req, res) => {
    try {
      const taskId = crypto.randomUUID();
      const filePath = req.file ? req.file.path : "uploads/dummy_satellite.png"; // 테스트용

      // 클라이언트가 이미지와 함께 보낸 이 위성 타일의 실제 지리적 범위 (BBox)
      // 예: 서울 특정 구역의 좌상단(minLon, maxLat) 및 우하단(maxLon, minLat)
      const { minLon, minLat, maxLon, maxLat } = req.body;

      if (!minLon || !minLat || !maxLon || !maxLat) {
        return res
          .status(400)
          .json({
            success: false,
            message: "타일 지리 범위(공간 메타데이터)가 누락되었습니다.",
          });
      }

      // 1. 위성 타일의 사각형 범위를 MySQL Polygon 규격(WKT)으로 생성
      const tilePolygon = {
        type: "Polygon",
        coordinates: [
          [
            [parseFloat(minLon), parseFloat(minLat)],
            [parseFloat(minLon), parseFloat(maxLat)],
            [parseFloat(maxLon), parseFloat(maxLat)],
            [parseFloat(maxLon), parseFloat(minLat)],
            [parseFloat(minLon), parseFloat(minLat)], // 닫힌 루프
          ],
        ],
      };

      // 2. 부모 태스크 생성
      await SatelliteTask.create({
        taskId: taskId,
        imagePath: filePath,
        tileBounds: tilePolygon,
        status: "QUEUED",
      });

      // 3. Redis 큐로 넘겨줄 페이로드 (AI 워커가 좌표 변환을 할 수 있도록 BBox 정보 포함)
      const taskPayload = {
        taskId,
        imagePath: filePath,
        extent: {
          minLon: parseFloat(minLon),
          minLat: parseFloat(minLat),
          maxLon: parseFloat(maxLon),
          maxLat: parseFloat(maxLat),
        },
      };

      // Redis client lPush 호출 부분 (생략 가능, 기존 큐 구조 유지)
      // await redisClient.lPush("image_queue", JSON.stringify(taskPayload));

      return res
        .status(202)
        .json({
          success: true,
          taskId,
          message: "위성 이미지 분석 대기열 진입 완료",
        });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  return router;
};
