'use strict';

// Module imports
var express = require('express')
  , http = require('http')
  , https = require('https')
  , bodyParser = require('body-parser')
  , fs = require("fs")
  , async = require('async')
  , log = require('npmlog-ts')
  , cors = require('cors')
;

// ************************************************************************
// Main code STARTS HERE !!
// ************************************************************************

log.stream = process.stdout;
log.timestamp = true;

// Main handlers registration - BEGIN
// Main error handler
process.on('uncaughtException', function (err) {
  log.info("","Uncaught Exception: " + err);
  log.info("","Uncaught Exception: " + err.stack);
});
// Detect CTRL-C
process.on('SIGINT', function() {
  log.info("","Caught interrupt signal");
  log.info("","Exiting gracefully");
  process.exit(2);
});
// Main handlers registration - END

log.level = 'verbose';

// Instantiate classes & servers
const wsURI       = '/socket.io'
    , restURI     = '/event/:eventname';
var restapp       = express()
  , restserver    = http.createServer(restapp)
;

const pingInterval = 25000
    , pingTimeout  = 60000
    , PORT = 11200
    , WSSPORT = 11111
    , NAMESPACE = "message"
    , REST  = "REST"
    , WS    = "WS"
    , ERROR = "ERROR"
;

//const SSLPATH = '/u01/ssl';
const SSLPATH = '/Users/ccasares/Documents/Oracle/Presales/Initiatives/Wedo/setup/wedoteam.io.certificate/2020';

const optionsSSL = {
  cert: fs.readFileSync(SSLPATH + "/certificate.fullchain.crt").toString(),
  key: fs.readFileSync(SSLPATH + "/certificate.key").toString()
};

// REST engine initial setup
restapp.use(bodyParser.urlencoded({ extended: true }));
restapp.use(bodyParser.json());
restapp.use(cors());

var wssapp = express()
  , serverSSL = https.createServer(optionsSSL, wssapp)
  , wssServer = require('socket.io')(serverSSL, {'pingInterval': pingInterval, 'pingTimeout': pingTimeout})
;

async.series([
    (next) => {
      const f_connection = (socket) => {
        log.info(WS,"Connected!!");
        socket.conn.on('heartbeat', () => {
          log.verbose(WS,'heartbeat');
        });
        socket.on(NAMESPACE, data => {
          log.info(WS,"Message received: " + data);
        });
        socket.on('disconnect', () => {
          log.info(WS,"Socket disconnected");
        });
        socket.on('error', err => {
          log.error(WS,"Error: " + err);
        });
      };
      wssServer.on('connection', f_connection);
      serverSSL.listen(WSSPORT, () => {
        log.info(WS,"Created WSS server at port: " + WSSPORT);
        next(null);  
      });
  },
    (next) => {
      restserver.listen(PORT, () => {
        log.info(REST,"REST server running on https://localhost:" + PORT + restURI);
        next(null);
      });
    }
], (err, results) => {
  if (err) {
    log.error(ERROR, err.message);
    process.exit(2);
  }
});

restapp.post(restURI, (req,res) => {
  res.status(204).send();
  serverSSL.sockets.emit(NAMESPACE, req.body);
});
