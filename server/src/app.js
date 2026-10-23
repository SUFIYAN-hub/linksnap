const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const linkRoutes = require('./routes/linkRoutes');
const { redirectToOriginal } = require('./controllers/linkController');

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: process.env.CLIENT_URL, // e.g. http://localhost:3000
    credentials: true,              // lets the browser send/receive cookies cross-origin
  })
);

app.get('/', (req, res) => {
  res.send('LinkSnap API is running');
});

app.use('/api/auth', authRoutes);
app.use('/api/links', linkRoutes);

app.get('/:shortCode', redirectToOriginal);

module.exports = app;