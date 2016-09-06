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

function firebaseSet(key, value) {
  firebaseApp.database().ref(key).set(value);
}

function firebaseUpdate(key, value) {
  firebaseApp.database().ref(key).update(value);
}

function scanNetwork() {
  var scanDate = Date.now();

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

      // save presence data (timestamp-only)
      var deviceKey = "devices/" + macMatch[0];
      var deviceData = {
        ipAddress: ipMatch[0],
        lastSeen: scanDate,
      };
      firebaseUpdate(deviceKey, deviceData);
    }
  });
}

initFirebase();

setInterval(scanNetwork, 10000);
scanNetwork();
