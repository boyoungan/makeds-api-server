module.exports = {
    development: {
      username: "anbo",
      password: "anbo1234",
      database: "makeds",
      host: "localhost",
      dialect: "postgres",
      port: 5432,
      logging: console.log,
      timezone: "+09:00" // 한국 시간대
    },
    production: {
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      host: process.env.DB_HOST,
      dialect: "postgres",
      port: process.env.DB_PORT || 5432,
      logging: false,
      timezone: "+09:00"
    }
  };