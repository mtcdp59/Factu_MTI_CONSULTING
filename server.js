// Simple Express server to serve index.html and app.js on localhost
const express = require('express');
const path = require('path');
const app = express();

const PORT = process.env.PORT || 8000;

// Serve static files (index.html, app.js, etc.) from root
app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Serveur local démarré sur http://localhost:${PORT}`);
});
