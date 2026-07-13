const express = require("express");
const { Sequelize } = require("sequelize");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// 1. 데이터베이스 연결 설정
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: "mysql",
    logging: console.log, // 터미널에 SQL 로그가 너무 많이 뜨는 것을 방지
  },
);

// 2. Sequelize 모델 로드 및 초기화
const Analysis = require("./models/Analysis")(sequelize);

// 3. 데이터베이스 동기화 및 서버 시작 함수
async function startServer() {
  try {
    await sequelize.authenticate();
    console.log("✅ MySQL 데이터베이스 연결 성공!");

    // DB 테이블 생성
    // alter: true 코드가 바뀌면 DB 구조도 안전하게 맞춰주는 옵션
    await sequelize.sync({ alter: true });
    console.log("✅ road_damages 공간 테이블 및 인덱스 동기화 완료!");

    // 서버 구동
    app.listen(PORT, async () => {
      console.log(`🚀 서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
    });
  } catch (error) {
    console.error("❌ 서버 구동 실패:", error);
    process.exit(1); // 에러 발생 시 프로세스 종료
  }
}

// 4. 기본 미들웨어 및 라우트 설정 (JSON 데이터 파싱)
app.use(express.json());

app.use(express.static("public"));

app.use("/uploads", express.static("uploads"));

const imageRouter = require("./routes/image")(sequelize);
app.use("/api/images", imageRouter);

const resultRouter = require("./routes/results")(sequelize);
app.use("/api/results", resultRouter);

const spatialRouter = require("./routes/spatial")(sequelize);
app.use("/api/spatial", spatialRouter);

app.get("/", (req, res) => {
  res.send("GeoAI 백엔드 서버 구동 중");
});

// 서버 실행
startServer();
