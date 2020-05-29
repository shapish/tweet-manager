// Server
const express = require('express');
const app = express();

// Startup
require('./startup/logging')();
require('./startup/db')();
require('./startup/prod')(app);
require('./startup/routes')(app);
require('./startup/config')();

// Initialize server
const port = process.env.PORT || 5000;
app.listen(port, () => { console.log(`Listening on port ${port}...`) });