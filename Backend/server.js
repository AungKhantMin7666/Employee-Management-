const express = require("express");
const cors = require("cors");
const bodyParser = require('body-parser');
const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const db = require("./models");

// db.sequelize
//   .sync()
//   .then(() => {
//     console.log("Synced db");
//   })
//   .catch((err) => {
//     console.log(err.message);
//   });

app.get("/", (req, res) => {
  res.json({ message: "Welcome to application." });
});

require("./routes/routes.js")(app);

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}.`);
});
