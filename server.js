const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from the dist directory
app.use(express.static(path.join(__dirname, 'dist')));

// Implement API endpoints for webhook handling
app.post('/api/webhook/dify', express.json(), (req, res) => {
  // This endpoint will be handled by the client-side code
  // through Supabase functions or edge functions in a real implementation
  res.status(200).json({ success: true });
});

// For any other route, serve the index.html file
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});