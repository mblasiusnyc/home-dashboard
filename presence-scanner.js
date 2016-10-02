/**
 * ARP Scanner
 * Used to establish which devices are on the network and log that information
 * in a database so we can try to determine who's home and when in a separate
 * process.
 */

var exec = require('child_process').exec;

var Firebase = require('firebase');
firebaseApp = null;

FIREBASE_NAMESPACE = 'devices';

function initFirebase() {
  firebaseConfig = {
    serviceAccount: "service-account-creds.json",
    databaseURL: "https://home-dashboard-9604a.firebaseio.com",
  };
  firebaseApp = Firebase.initializeApp(firebaseConfig);
}

function firebaseSet(key, value) {
  firebaseApp.database().ref(key).set(value);
}

function firebaseUpdate(key, value) {
  console.log("FIREBASE UPDATE: " + key, value);
  firebaseApp.database().ref(key).update(value);
}

function createEventIfNecessary(deviceObject) {
  // we declare that someone has left the premises if we haven't seen them in
  // 15 minutes
  var LEFT_HOME_THRESHOLD = 60 * 10 * 1000;

  // did someone arrive home after being absent?
  // if (deviceObject.lastSeen - deviceObject.prevLastSeen > LEFT_HOME_THRESHOLD) {

  // }
}

function scanNetwork() {
  var scanDate = Date.now();

  console.log("Scanning network... ", scanDate);

  var macRegex = /(\w{2}:\w{2}:\w{2}:\w{2}:\w{2}:\w{2})/;
  var ipRegex = /(?:[0-9]{1,3}\.){3}[0-9]{1,3}/;

  var cmd = 'sudo arp-scan -l';
  var newDeviceData = {};
  exec(cmd, function(error, stdout, stderr) {
    var outputLines = stdout.split('\n');

    for (var i = outputLines.length - 1; i >= 0; i--) {
      var macMatch = outputLines[i].match(macRegex);
      var ipMatch = outputLines[i].match(ipRegex);

      if (macMatch === null || ! macMatch) {
        console.log("skipping");
        continue;
      }

      console.log("running", macMatch[0]);

      var macAddress = macMatch[0];

      // save timestamp of previous sighting
      var deviceStore = firebaseApp.database().ref(FIREBASE_NAMESPACE);

      newDeviceData[macAddress] = {
        ipAddress: ipMatch[0],
        lastSeen: scanDate,
        prevLastSeen: 0,
      };
    }

    /**
     * Check all our known devices, doing housekeeping & creating events
     */
    deviceStore.once("value", (snapshot) => {
      var deviceListInFirebase = snapshot.val();

      for (var deviceFirebaseKey in newDeviceData) {
        if (deviceListInFirebase.hasOwnProperty(deviceFirebaseKey)) {
          if (deviceListInFirebase[deviceFirebaseKey].hasOwnProperty('lastSeen')) {
            // move the previous timestamp into prevLastSeen
            newDeviceData[deviceFirebaseKey].prevLastSeen = deviceListInFirebase[deviceFirebaseKey].lastSeen;
          }
        }

        createEventIfNecessary(newDeviceData);

        var updateKey = FIREBASE_NAMESPACE + '/' + deviceFirebaseKey;
        firebaseUpdate(updateKey, newDeviceData[deviceFirebaseKey]);
      }
    });
  });
}

initFirebase();

setInterval(scanNetwork, 10000);
scanNetwork();
