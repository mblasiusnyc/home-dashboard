/**
 * Speed Test
 * Runs and records an internet bandwidth test. Intended to be run on an
 * interval for the purpose of creating graphs.
 */

testCount = 0;
MAX_TEST_COUNT = 5;
downloadResults = [];
uploadResults = [];
pingResults = [];

var speedTest = require('speedtest-net');

// TODO: refactor into FirebaseLib
var Firebase = require('firebase');
firebaseApp = null;

FIREBASE_NAMESPACE = 'speedtest-results';

function initFirebase() {
  firebaseConfig = {
    serviceAccount: "service-account-creds.json",
    databaseURL: "https://home-dashboard-9604a.firebaseio.com",
  };
  firebaseApp = Firebase.initializeApp(firebaseConfig);
}

function firebaseSet(key, value) {
  console.log ("setting " + key + " to ", value);
  firebaseApp.database().ref(key).set(value);
}

function firebaseUpdate(key, value) {
  firebaseApp.database().ref(key).update(value);
}

function firebasePush(parentKey, value) {
  firebaseApp.database().ref().child(parentKey).push(value);
}

function performAndRecordTest() {
  console.log("Performing test #", testCount);

  var test = speedTest({maxTime: 5000});

  test.on('data', (data) => {
    downloadResults.push(data.speeds.download);
    uploadResults.push(data.speeds.upload);
    pingResults.push(data.server.ping);
    testCount++;

    if (testCount >= MAX_TEST_COUNT) {

      // calculate and record averages
      var meanDownload = null;
      var meanUpload = null;
      var meanPing = null;

      for (var i = 0; i < testCount; i++) {
        meanDownload += parseInt(downloadResults[i], 10);
        meanUpload += parseInt(uploadResults[i], 10);
        meanPing += parseInt(pingResults[i], 10);
      }

      meanDownload = meanDownload / testCount;
      meanUpload = meanUpload / testCount;
      meanPing = meanPing / testCount;

      recordTest(meanDownload, meanUpload, meanPing);

    } else {
      performAndRecordTest();
    }
  });
}

function recordTest(download, upload, ping) {
  var speedtestData = {
    download: download,
    upload: upload,
    ping: ping,
    timestamp: Date.now(),
  };

  // console.log("Data: ", speedtestData);

  firebasePush(FIREBASE_NAMESPACE, speedtestData);
}

function cleanUpTests() {
  var oneWeek = 60 * 60 * 24 * 7 * 1000;
  var now = Math.round(new Date().getTime());
  var oneWeekAgo = now - oneWeek;

  console.log("now: ", now);
  console.log("one week of ms: ", oneWeekAgo);
  console.log("finding results between 0 and " + oneWeekAgo);

  firebaseApp.database().ref(FIREBASE_NAMESPACE).
    orderByChild('timestamp').
    startAt(0).
    endAt(oneWeekAgo).
    once('value', function(snapshot) {
      console.log("Removing " + Object.keys(snapshot.val()).length + " records");

      var dataToRemove = snapshot.val();
      var dataKeys = Object.keys(dataToRemove);

      var updates = {};

      for (let i = 0; i < dataKeys.length; i++) {
        let recordKey = dataKeys[i];
        updates[FIREBASE_NAMESPACE + "/" + recordKey] = null;
      }

      return firebaseApp.database().ref().update(updates);
    });
}

initFirebase();
performAndRecordTest();
cleanUpTests();

setTimeout(function() {
  process.exit();
}, 10000);
