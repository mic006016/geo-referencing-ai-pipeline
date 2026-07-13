const { Sequelize } = require("sequelize");

const sequelize = new Sequelize("geo_db", "root", "1234", {
  host: "localhost",
  port: 3311,
  dialect: "mysql",
  logging: false,
});

// 모델 로드
const Analysis = require("./Analysis")(sequelize);

// 전체 동기화 (가장 상위에서 한 번만 호출)
sequelize.sync({ alter: true }).then(() => {
  console.log("✅ DB 및 테이블 동기화 완료");
});

module.exports = { sequelize, Analysis };
