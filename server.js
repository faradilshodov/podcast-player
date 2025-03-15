const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const CryptoJS = require('crypto-js');
const fetch = require('node-fetch');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const authKey = process.env.AUTH_KEY;
const secretKey = process.env.SECRET_KEY;
const userAgent = process.env.USER_AGENT;
const apiEndpoint = process.env.API_ENDPOINT;

app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});