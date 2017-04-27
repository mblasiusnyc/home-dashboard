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

  // TODO: EXTRACT THIS INTO FIREBASE CONFIG FILE
  var dbURL = "https://blasius-home-dashboard.firebaseio.com";

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



function initApp(callbackWhenDone) {
  if (typeof callbackWhenDone !== "function") {
    console.log("Warning: no callback function passed to initApp()");
  }

  let deviceConfigFile = "deviceConfig.json";

  if ( ! fs.existsSync(deviceConfigFile)) {
    let deviceId = firebaseApp.database().ref("/scanners").push({"dateRegistered": Date.now()}).key;
    console.log("new deviceId: ", deviceId);

    let deviceConfig = {
      "deviceId": deviceId,
    };

    fs.writeFileSync(deviceConfigFile, JSON.stringify(deviceConfig));
  }

  deviceConfig = JSON.parse(fs.readFileSync(deviceConfigFile));

  request('GET', 'https://api.ipify.org?format=json')
    .then((res) => {
      if (res.statusCode == 200) {
        bodyObject = JSON.parse(res.body);

        let devicePath = "scanners/" + deviceConfig.deviceId;
        let newIpAddress = bodyObject.ip.trim();
        console.log("devicePath=", devicePath, newIpAddress);

        firebaseApp.database().ref(devicePath).child("ipAddress").set(newIpAddress).then( () => {
          console.log("Updated ipAddress. Now loading remote config");
          firebaseApp.database().ref(devicePath).once("value", (remoteConfigSnapshot) => {
            let remoteDeviceConfig = remoteConfigSnapshot.val();

            // TODO: extend remote device config onto local config generically
            console.log("remoteDeviceConfig: ", remoteDeviceConfig);
            deviceConfig["placeId"] = remoteDeviceConfig.placeId;
            callbackWhenDone();
          });
        });
      } else {
        console.log("Failed to look up IP address", res.statusCode);
        callbackWhenDone();
      }
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
  var to_email = new SendGridHelper.Email(process.env.ADMIN_EMAIL, process.env.ADMIN_NAME);
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
    console.log("outputLines: ",outputLines)

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
    let devicesRef = firebaseApp.database().ref('devices/' + deviceConfig.deviceId);
    devicesRef.transaction( (deviceListInFirebase) => {
      if (deviceListInFirebase) {

        // iterate over list of updated devices, then commit those updates
        for (let deviceFirebaseKey in newDeviceData) {
          // merge if already exists
          if (deviceListInFirebase.hasOwnProperty(deviceFirebaseKey)) {
            Object.assign(deviceListInFirebase[deviceFirebaseKey], newDeviceData[deviceFirebaseKey]);
          } else {
            deviceListInFirebase[deviceFirebaseKey] = newDeviceData[deviceFirebaseKey];
          }
        }

        // remove dummy data
        if (deviceListInFirebase.hasOwnProperty("initialized")) {
          delete deviceListInFirebase.initialized;
        }

        lastKnownDeviceList = deviceListInFirebase;
        return deviceListInFirebase;

      } else {
        // seed the key with some dummy data. this is probably not best practice...
        return { "initialized": 1 };
      }

    }).then( () => {
      if ( ! deviceConfig.placeId) {
        console.log("This scanner isn't associated with a Place yet; no occupants to process.");
        return;
      }

      let occupantsPath = 'occupants/' + deviceConfig.placeId;
      console.log("Processing occupants at", occupantsPath);

      occupantsRef = firebaseApp.database().ref(occupantsPath);
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

function beginScanning() {
  setInterval(scanNetwork, 10000);
  scanNetwork();
}

initFirebase();
initApp(beginScanning);
