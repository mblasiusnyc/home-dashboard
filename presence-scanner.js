/**
 * ARP Scanner
 * Used to establish which devices are on the network and log that information
 * in a database so we can try to determine who's home and when in a separate
 * process.
 */

var exec = require('child_process').exec;
var fs = require('fs');
var request = require('then-request');
var FirebaseAdmin = require('firebase-admin');
var SendGridHelper = require('sendgrid').mail;
require('dotenv').config();

firebaseApp = null;
deviceConfig = {};

FIREBASE_NAMESPACE = 'devices';

function initFirebase() {
  var serviceAccount = require("./service-account-creds.json");

  var dbURL = "https://home-dashboard-9604a.firebaseio.com";
  // var dbURL = "https://homebase-dev.firebaseio.com";

  var firebaseConfig = {
    credential: FirebaseAdmin.credential.cert(serviceAccount),
    databaseURL: dbURL,
  };
  firebaseApp = FirebaseAdmin.initializeApp(firebaseConfig);
}

function firebaseSet(key, value) {
  firebaseApp.database().ref(key).set(value);
}

function firebaseUpdate(key, value) {
  console.log("FIREBASE UPDATE: " + key, value);
  firebaseApp.database().ref(key).update(value);
}



function initApp() {
  let deviceConfigFile = "deviceConfig.json";

  if ( ! fs.existsSync(deviceConfigFile)) {
    let deviceId = firebaseApp.database().ref("/scanners").push({"dateRegistered": firebaseApp.database.ServerValue.TIMESTAMP}).key;
    console.log("new deviceId: ", deviceId);

    let deviceConfig = {
      "deviceId": deviceId,
    };

    fs.writeFileSync(deviceConfigFile, JSON.stringify(deviceConfig));
  }

  deviceConfig = JSON.parse(fs.readFileSync(deviceConfigFile));
  console.log("deviceConfig: ", deviceConfig);

  return request('GET', 'https://api.ipify.org?format=json')
    .then((res) => {
      if (res.statusCode == 200) {
        bodyObject = JSON.parse(res.body);

        firebaseApp.database().ref("scanners/" + deviceConfig.deviceId).transaction( (remoteDeviceConfig) => {
          if (remoteDeviceConfig) {
            remoteDeviceConfig["ipAddress"] = bodyObject.ip.trim();
            return remoteDeviceConfig;
          }
        });
      } else {
        console.log("Failed to look up IP address", res.statusCode);
      }

      return Promise.resolve();
    });
}



function sendEventNotifications(newEvent, occupant) {
  // for now just email Jeff with things
  // TODO: add system for users to subscribe to notifications

  let subject = "";
  let contentText = "";

  if (newEvent.type == "arrivedHome") {
    subject = occupant.name + " arrived at home.";
    contentText = "Hey there!\n\nJust a heads up that " + occupant.name + " arrived safely at home.\n\n\n\-Homebase";
  } else if (newEvent.type == "leftHome") {
    subject = occupant.name + " left home.";
    contentText = "Hey there!\n\nJust a heads up that " + occupant.name + " left home.\n\n\n\-Homebase";
  } else {
    console.error("Unrecognized event type: " + newEvent.type + " - not sending a notification.");
    return;
  }

  var from_email = new SendGridHelper.Email('notify@homedashboard.me', 'Homebase');
  var to_email = new SendGridHelper.Email('jefftheman45@gmail.com', 'Jeff Stephens');
  var content = new SendGridHelper.Content('text/plain', contentText);

  var mail = new SendGridHelper.Mail();
  var personalization = new SendGridHelper.Personalization();

  personalization.addTo(to_email);

  mail.setFrom(from_email);
  mail.setSubject(subject);
  mail.addContent(content);
  mail.addPersonalization(personalization);

  var sg = require('sendgrid')(process.env.SENDGRID_API_KEY);
  var request = sg.emptyRequest({
    method: 'POST',
    path: '/v3/mail/send',
    body: mail.toJSON(),
  });

  sg.API(request, function(error, response) {
    console.log(response.statusCode);
    console.log(response.body);
    console.log(response.headers);
  });
}

function scanNetwork() {
  console.log("scanning");

  var scanDate = Date.now();

  var macRegex = /(\w{2}:\w{2}:\w{2}:\w{2}:\w{2}:\w{2})/;
  var ipRegex = /(?:[0-9]{1,3}\.){3}[0-9]{1,3}/;

  var cmd = 'sudo arp-scan -l';
  var newDeviceData = {};
  var lastKnownDeviceList = {};

  exec(cmd, function(error, stdout, stderr) {
    var outputLines = stdout.split('\n');

    for (var i = outputLines.length - 1; i >= 0; i--) {
      var macMatch = outputLines[i].match(macRegex);
      var ipMatch = outputLines[i].match(ipRegex);

      if (macMatch === null || ! macMatch) {
        continue;
      }

      var macAddress = macMatch[0];

      newDeviceData[macAddress] = {
        ipAddress: ipMatch[0],
        lastSeen: scanDate,
      };
    }

    /**
     * Check all our known devices, doing housekeeping & creating events
     */
    var devicesRef = firebaseApp.database().ref('devices');
    devicesRef.transaction( (deviceListInFirebase) => {
      if (deviceListInFirebase) {

        // iterate over list of updated devices, then commit those updates
        for (var deviceFirebaseKey in newDeviceData) {
          // merge if already exists
          if (deviceListInFirebase.hasOwnProperty(deviceFirebaseKey)) {
            Object.assign(deviceListInFirebase[deviceFirebaseKey], newDeviceData[deviceFirebaseKey]);
          } else {
            deviceListInFirebase[deviceFirebaseKey] = newDeviceData[deviceFirebaseKey];
          }
        }

        lastKnownDeviceList = deviceListInFirebase;
        return deviceListInFirebase;

      } else {
        // seed the key with some dummy data. this is probably not best practice...
        return { "initialized": 1 };
      }

    }).then( () => {
      occupantsRef = firebaseApp.database().ref('occupants');

      occupantsRef.transaction( (occupants) => {
        if (occupants) {

          // update presence state for each occupant
          for (let occupantKey in occupants) {
            let thisOccupant = occupants[occupantKey];

            if (lastKnownDeviceList.hasOwnProperty(thisOccupant.deviceId)) {
              let associatedDevice = lastKnownDeviceList[thisOccupant.deviceId];

              // we declare that someone has left the premises if we haven't seen them in
              // 15 minutes
              let LEFT_HOME_THRESHOLD = 60 * 15 * 1000;

              let oldStatus = { "status": thisOccupant.status };

              if (Date.now() - associatedDevice.lastSeen < LEFT_HOME_THRESHOLD) {
                // device is online
                thisOccupant.status = "home";
              } else {
                // device is offline
                thisOccupant.status = "away";
              }

              // log event for when an occupant changes state
              if (thisOccupant.status != oldStatus.status) {
                let eventTypes = {
                  home: "arrivedHome",
                  away: "leftHome",
                };
                let eventType = "unknown";

                if (eventTypes.hasOwnProperty(thisOccupant.status)) {
                  eventType = eventTypes[thisOccupant.status];
                }

                let newEvent = {
                  occupantId: occupantKey,
                  timestamp: Date.now(),
                  type: eventType,
                };

                sendEventNotifications(newEvent, thisOccupant);

                firebaseApp.database().ref('events').push(newEvent);
              }
            }
          }

          return occupants;

        } else {
          // seed the key with some dummy data. this is probably not best practice...
          return { "initialized" : 1 }
        }
      })
    });
  });
}

initFirebase();
initApp().then( () => {
  setInterval(scanNetwork, 10000);
  scanNetwork();
});
