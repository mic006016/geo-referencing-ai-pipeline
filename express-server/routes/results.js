// routes/results.js
const express = require("express");
const router = express.Router();

module.exports = (sequelize) => {
  const { SatelliteTask, SpatialObject } = sequelize.models;

  router.post("/save", async (req, res) => {
    const t = await sequelize.transaction(); // 동시성 관리를 위한 트랜잭션 보장
    try {
      const { taskId, status, detectedObjects } = req.body;

      // 1. 부모 테이블(Task) 상태 업데이트
      await SatelliteTask.update(
        { status: status },
        { where: { taskId: taskId }, transaction: t },
      );

      if (
        status === "COMPLETED" &&
        detectedObjects &&
        detectedObjects.length > 0
      ) {
        // 2. AI가 찾은 N개의 객체 배열을 GeoJSON Point 규격으로 가공하여 벌크 인서트
        const recordsToInsert = detectedObjects.map((obj) => ({
          taskId: taskId,
          objectType: obj.objectType,
          confidence: obj.confidence,
          coordinates: {
            type: "Point",
            coordinates: [obj.longitude, obj.latitude], // GeoJSON 표준: [경도, 위도]
          },
        }));

        await SpatialObject.bulkCreate(recordsToInsert, { transaction: t });
      }

      await t.commit();
      console.log(
        `✅ [DB Bulk Insert] Task ID: ${taskId} - 공간 객체 적재 완료`,
      );
      return res.status(200).json({ success: true });
    } catch (error) {
      await t.rollback();
      console.error("❌ 결과 적재 실패:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
};
