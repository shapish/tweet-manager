// Server
const express = require('express');
const app = express();

// Startup
require('./startup/db')();
require('./startup/prod')(app);
require('./startup/routes')(app);

// Initialize server
const port = process.env.PORT || 5000;
app.listen(port, () => { console.log(`Listening on port ${port}...`) });