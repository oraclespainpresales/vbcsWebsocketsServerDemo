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

log.stream = process.stdout;
log.timestamp = true;

const REST  = "REST"
    , WS    = "WS"
    , ERROR = "ERROR"
;

// Main error handlers
process.on('uncaughtException', function (err) {
  log.info(ERROR,"Uncaught Exception: " + err);
  log.info(ERROR,"Uncaught Exception: " + err.stack);
});
// Detect CTRL-C
process.on('SIGINT', function() {
  log.info(ERROR,"Caught interrupt signal");
  log.info(ERROR,"Exiting gracefully");
  process.exit(2);
});

log.level = 'verbose';

// Instantiate classes & servers
const wsURI       = '/socket.io'
    , restURI     = '/message';
var restapp       = express()
  , restserver    = http.createServer(restapp)
;

const pingInterval = 25000
    , pingTimeout  = 60000
    , PORT = 50001
    , WSSPORT = 50443
    , NAMESPACE = "message"
;

const SSLPATH = '/u01/ssl';
//const SSLPATH = '/Users/ccasares/Documents/Oracle/Presales/Initiatives/Wedo/setup/wedoteam.io.certificate/2020';

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
          log.info(WS,`Message received: ${JSON.stringify(data)}`);
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
        log.info(WS,`Created WSS server at port: ${WSSPORT}`);
        next(null);  
      });
  },
    (next) => {
      restserver.listen(PORT, () => {
        log.info(REST,`REST server running on http://localhost:${PORT}${restURI}`);
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
  log.info(REST, `Forwarding message to all WS clients: ${JSON.stringify(req.body)}`)
  wssServer.sockets.emit(NAMESPACE, req.body);
});
