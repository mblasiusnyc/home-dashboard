/**
 * ARP Scanner
 * Used to establish which devices are on the network and log that information
 * in a database so we can try to determine who's home and when in a separate
 * process.
 */

var exec = require('child_process').exec;

var Firebase = require('firebase');
firebaseApp = null;

function initFirebase() {
  var firebaseConfig = {
    apiKey: "AIzaSyDEHc7ws4S0JeV2HuDvMMjTFqbO-TDkgd8",
    authDomain: "home-dashboard-9604a.firebaseapp.com",
    databaseURL: "https://home-dashboard-9604a.firebaseio.com",
    storageBucket: "home-dashboard-9604a.appspot.com",
  };
  firebaseApp = Firebase.initializeApp(firebaseConfig);
}

function saveToFirebase(key, value) {
  firebaseApp.database().ref().child(key).push(value);
}

function scanNetwork() {
  var scanDate = Date.now();
  var dbKey = "presences"

  console.log("Scanning network... ", scanDate);

  var macRegex = /(\w{2}:\w{2}:\w{2}:\w{2}:\w{2}:\w{2})/;
  var ipRegex = /(?:[0-9]{1,3}\.){3}[0-9]{1,3}/;

  var cmd = 'sudo arp-scan -l';
  exec(cmd, function(error, stdout, stderr) {
    var outputLines = stdout.split('\n');

    for (var i = outputLines.length - 1; i >= 0; i--) {
      var macMatch = outputLines[i].match(macRegex);
      var ipMatch = outputLines[i].match(ipRegex);

      if (macMatch === null || ! macMatch) {
        continue;
      }

      var presenceData = {
        macAddress: macMatch[0],
        ipAddress: ipMatch[0],
        timestamp: scanDate,
      };

      saveToFirebase(dbKey, presenceData);
    }
  });
}

initFirebase();

setInterval(scanNetwork, 60000);
