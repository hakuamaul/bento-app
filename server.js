const express = require("express");
const fetch = require("node-fetch");
const app = express();
app.use(express.json());

app.get("/proxy", async (req, res) => {
  const targetUrl = "https://script.google.com/macros/s/AKfycbwi7MOdmtz0iR6JlxVVDvr0lnxzyuQniDDpdVsOy4dhioqZSRbrmSg0avwC3qRPJU4/exec";
  const data = req.query.data;
  try {
    const response = await fetch(`${targetUrl}?data=${data}`);
    res.send("Success");
  } catch (e) {
    res.status(500).send("Error");
  }
});

app.listen(process.env.PORT || 3000);
