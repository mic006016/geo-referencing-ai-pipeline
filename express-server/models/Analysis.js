// models/Analysis.js
const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  // 1. 위성 이미지 업로드 태스크 관리 테이블
  const SatelliteTask = sequelize.define(
    "SatelliteTask",
    {
      taskId: {
        type: DataTypes.STRING(50),
        primaryKey: true,
        field: "task_id",
      },
      imagePath: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: "image_path",
      },
      // 이미지 타일이 커버하는 실제 지구상의 사각형 영역 (Polygon)
      tileBounds: {
        type: DataTypes.GEOMETRY("POLYGON", 4326),
        allowNull: false,
        field: "tile_bounds",
      },
      status: {
        type: DataTypes.ENUM("QUEUED", "PROCESSING", "COMPLETED", "FAILED"),
        defaultValue: "QUEUED",
      },
    },
    { tableName: "satellite_tasks" },
  );

  // 2. AI가 탐지하여 실제 위경도로 매핑한 개별 객체 테이블
  const SpatialObject = sequelize.define(
    "SpatialObject",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      taskId: {
        type: DataTypes.STRING(50),
        allowNull: false,
        field: "task_id",
      },
      objectType: {
        type: DataTypes.STRING(50), // 예: 'Building', 'Vehicle', 'Ship'
        allowNull: false,
        field: "object_type",
      },
      confidence: {
        type: DataTypes.FLOAT,
        allowNull: false,
      },
      // AI 픽셀 좌표가 지리 좌표로 변환된 최종 포인트 (Point)
      coordinates: {
        type: DataTypes.GEOMETRY("POINT", 4326),
        allowNull: false,
      },
    },
    { tableName: "spatial_objects" },
  );

  // 관계 설정 (1:N)
  SatelliteTask.hasMany(SpatialObject, {
    foreignKey: "taskId",
    as: "detectedObjects",
  });
  SpatialObject.belongsTo(SatelliteTask, { foreignKey: "taskId" });

  return { SatelliteTask, SpatialObject };
};
