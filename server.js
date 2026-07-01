const express = require('express');
const fetch = require('node-fetch');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// ブラウザから「/proxy」にアクセスが来たら、Googleに転送する
app.get('/proxy', async (req, res) => {
  const targetUrl = "https://script.google.com/macros/s/AKfycbwi7MOdmtz0iR6JlxVVDvr0lnxzyuQniDDpdVsOy4dhioqZSRbrmSg0avwC3qRPJU4/exec";
  const data = req.query.data;
  
  if (!data) {
    return res.status(400).send("データがありません");
  }

  try {
    const response = await fetch(`${targetUrl}?data=${encodeURIComponent(data)}`);
    const result = await response.text();
    res.send("Success: " + result);
  } catch (e) {
    console.error(e);
    res.status(500).send("Error: " + e.message);
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
