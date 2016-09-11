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


/**
 * NETWORK DEVICES
 */


function updateDeviceListeners() {
  $("button.edit-device-name").on('click', function() {
    var friendlyName = $(this).data("friendly-name");
    var macAddress = $(this).data("mac-address");
    var promptMessage = null;

    if (friendlyName) {
      promptMessage = "Rename " + friendlyName;
    } else {
      promptMessage = "Rename " + macAddress;
    }

    var newName = prompt(promptMessage);

    if (newName) {
      nameDevice(macAddress, newName);
    }
  });

  $("button.hide-device").on('click', function() {
    var friendlyName = $(this).data("friendly-name");
    var macAddress = $(this).data("mac-address");
    var promptMessage = null;

    if (friendlyName) {
      promptMessage = "Really hide " + friendlyName + "?";
    } else {
      promptMessage = "Really hide " + macAddress + "?";
    }

    var reallyHide = confirm(promptMessage);

    if (reallyHide) {
      hideDevice(macAddress);
    }
  });

  $("button.show-device").on('click', function() {
    var friendlyName = $(this).data("friendly-name");
    var macAddress = $(this).data("mac-address");
    var promptMessage = null;

    if (friendlyName) {
      promptMessage = "Really show " + friendlyName + "?";
    } else {
      promptMessage = "Really show " + macAddress + "?";
    }

    var reallyHide = confirm(promptMessage);

    if (reallyHide) {
      showDevice(macAddress);
    }
  });
}

function watchDevices() {
  var deviceList = firebase.database().ref('devices');

  deviceList.on('value', function(snapshot) {

    var deviceList = snapshot.val();
    deviceCache = deviceList;

    var shownDevices = [];
    var hiddenDevices = [];

    for (var macAddress in deviceList) {
      if (deviceList.hasOwnProperty(macAddress)) {
        var deviceInfo = deviceList[macAddress];
        deviceInfo.macAddress = macAddress;
        deviceInfo.rawLastSeen = deviceInfo.lastSeen;
        deviceInfo.lastSeen = moment(deviceInfo.lastSeen).fromNow();

        if (deviceInfo.hasOwnProperty('hideInDashboard') && deviceInfo.hideInDashboard) {
          hiddenDevices.push(deviceInfo);
        } else {
          shownDevices.push(deviceInfo);
        }
      }
    }

    var templateSource = $("#device-profile-template").html();

    var shownTemplate = Handlebars.compile(templateSource);
    $("#shown-device-container").html(shownTemplate({"devices": shownDevices}));

    var hiddenTemplate = Handlebars.compile(templateSource);
    $("#hidden-device-container").html(shownTemplate({"devices": hiddenDevices}));

    updateDeviceListeners();

  });
}

function nameDevice(macAddress, newName) {
  deviceKey = "devices/" + macAddress
  newData = {
    friendlyName: newName
  };
  firebaseUpdate(deviceKey, newData);
}

function hideDevice(macAddress) {
  deviceKey = "devices/" + macAddress;
  newData = {
    hideInDashboard: true
  };
  firebaseUpdate(deviceKey, newData);
}

function showDevice(macAddress) {
  deviceKey = "devices/" + macAddress;
  newData = {
    hideInDashboard: false
  };
  firebaseUpdate(deviceKey, newData);
}

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


initFirebase();
initUI();
watchDevices();
