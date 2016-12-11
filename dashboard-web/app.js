/**
 * FIREBASE
 */

function initFirebase() {
  var firebaseConfig = {
    apiKey: "AIzaSyDEHc7ws4S0JeV2HuDvMMjTFqbO-TDkgd8",
    authDomain: "home-dashboard-9604a.firebaseapp.com",
    databaseURL: "https://home-dashboard-9604a.firebaseio.com",
    storageBucket: "home-dashboard-9604a.appspot.com",
  };
  firebase.initializeApp(firebaseConfig);
}

function firebaseUpdate(key, value) {
  console.log("Updating firebase " + key, value);
  firebase.database().ref(key).update(value);
}

function firebasePush(parentKey, value) {
  firebase.database().ref().child(parentKey).push(value);
}

var deviceCache = {};
var occupantCache = {};

function searchDeviceCache(keyword) {
  var matches = [];

  keyword = keyword.toLowerCase().trim();
  var searchRegex = new RegExp('.*' + keyword + '.*', "gi");

  for (var device in deviceCache) {
    // ignore hidden devices
    if (deviceCache[device].hideInDashboard) {
      continue;
    }

    deviceCache[device].deviceId = device;

    if (deviceCache[device].hasOwnProperty('friendlyName')) {
      if (deviceCache[device].friendlyName.match(searchRegex)) {
        matches.push(deviceCache[device]);
        continue;
      }
    }

    if (deviceCache[device].macAddress.match(searchRegex)) {
      matches.push(deviceCache[device]);
    }
  }

  return matches;
}


/**
 * OCCUPANTS
 */


function initOccupants() {
  var occupantList = firebase.database().ref('occupants');

  occupantList.on('value', function(snapshot) {
    var resultList = snapshot.val();
    processOccupantResults(resultList);
  });
}

function forceRefreshOccupants() {
  var occupantList = firebase.database().ref('occupants');

  occupantList.on('value', function(snapshot) {
    var resultList = snapshot.val();
    processOccupantResults(resultList);
  });
}

function processOccupantResults(resultList) {
  var resultArray = [];

  for (var result in resultList) {
    if (resultList.hasOwnProperty(result)) {
      resultList[result].occupantId = result;

      // if a device is associated, cross-reference some data
      if (resultList[result].hasOwnProperty('deviceId')) {
        var associatedDeviceId = resultList[result].deviceId;
        var associatedDevice = deviceCache[associatedDeviceId];

        // fetch the device name, falling back to its MAC address
        if (associatedDevice.hasOwnProperty('friendlyName')) {
          resultList[result].deviceName = associatedDevice.friendlyName;
        } else {
          resultList[result].deviceName = associatedDevice.macAddress;
        }

        resultList[result].lastSeen = associatedDevice.lastSeen;
      }

      resultList[result].statusHome = resultList[result].status == "home";
      resultList[result].statusAway = resultList[result].status == "away";

      resultArray.push(resultList[result]);
    }
  }

  occupantCache = resultArray;
  updateOccupantsDisplay(resultArray);
}

function updateOccupantsDisplay(occupantArray) {
  // abort if the user is currently mapping a device to an occupant
  if ($(".device-search:focus").length) {
    return;
  }

  var templateSource = $("#occupant-profile-template").html();
  var template = Handlebars.compile(templateSource);
  $('#occupant-container').html(template({"occupants": occupantArray}));

  updateOccupantListeners();
}

function updateOccupantListeners() {
  $('button.add-occupant-button').off('click');
  $('button.add-occupant-button').on('click', function() {
    var newOccupantName = prompt('New occupant\'s name?');

    if (newOccupantName) {
      var newOccupant = {
        name: newOccupantName,
      }

      firebasePush('occupants', newOccupant);
    }
  });

  $("button.edit-occupant-name").on('click', function() {
    var occupantName = $(this).data("name");
    var occupantId = $(this).data("occupant-id");

    var newName = prompt('Rename ' + occupantName);

    if (newName) {
      var updatedOccupant = {
        name: newName,
      }

      firebaseUpdate('occupants/' + occupantId, updatedOccupant);
    }
  });

  $("button.remove-occupant").on('click', function() {
    var occupantName = $(this).data("name");
    var occupantId = $(this).data("occupant-id");

    var reallyRemove = confirm('Really remove ' + occupantName + '? There is no undo.');

    if (reallyRemove) {
      firebase.database().ref().child('occupants/' + occupantId).remove();
    }
  });

  $(".device-search").on('keyup', function() {
    var keyword = $(this).val();
    var occupantId = $(this).data('occupant-id');
    var resultsContainer = $('.device-results-container[data-occupant-id="' + occupantId + '"]');

    if ( ! keyword || keyword.length === 0) {
      resultsContainer.html('');
      return;
    }

    var templateSource = $("#device-search-template").html();
    var template = Handlebars.compile(templateSource);

    var matches = searchDeviceCache(keyword);
    resultsContainer.html(template({"matches": matches}));

    updateDeviceSearchListeners(occupantId);
  });
}

function updateDeviceSearchListeners(occupantId) {
  var resultsContainer = $('.device-results-container[data-occupant-id="' + occupantId + '"] .device-search-result');

  resultsContainer.off('click');
  resultsContainer.on('click', function() {
    updateDeviceForOccupant(occupantId, $(this).data('device-id'));
  });
}

function updateDeviceForOccupant(occupantId, deviceId) {
  firebaseUpdate('occupants/' + occupantId, {
    'deviceId': deviceId
  });
}

function watchDevices() {
  var deviceList = firebase.database().ref('devices');

  deviceList.on('value', function(snapshot) {

    var deviceList = snapshot.val();

    for (var macAddress in deviceList) {
      if (deviceList.hasOwnProperty(macAddress)) {
        var deviceInfo = deviceList[macAddress];
        deviceInfo.macAddress = macAddress;
        deviceInfo.rawLastSeen = deviceInfo.lastSeen;
        deviceInfo.lastSeen = moment(deviceInfo.lastSeen).fromNow();
      }
    }

    deviceCache = deviceList;
    forceRefreshOccupants();

  });
}


/**
 * AUTHENTICATION
 */

function initAuth() {
  firebase.auth().onAuthStateChanged(function(user) {
    if ( ! user) {
      window.location.href="/login.html";
    }
  });
}


/**
 * UI
 */


function initUI() {
  $('#signout').on('click', function(event) {
    event.preventDefault();
    firebase.auth().signOut();
  });
}


/**
 * INITIALIZATION - WHERE EVERYTHING STARTS
 */


function updateListeners() {
  updateDeviceListeners();
  updateOccupantListeners();
}

initFirebase();
initAuth();
initUI();
watchDevices();
