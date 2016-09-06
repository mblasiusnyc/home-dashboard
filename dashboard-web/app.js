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
  firebase.database().ref(key).update(value);
}

function updateListeners() {
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
}

function watchDevices() {
  var deviceList = firebase.database().ref('devices');

  deviceList.on('value', function(snapshot) {

    var deviceList = snapshot.val();
    var deviceArray = [];

    for (var macAddress in deviceList) {
      if (deviceList.hasOwnProperty(macAddress)) {
        var deviceInfo = deviceList[macAddress];
        deviceInfo.macAddress = macAddress;
        deviceInfo.lastSeen = moment(deviceInfo.lastSeen).fromNow();
        deviceArray.push(deviceInfo);
      }
    }

    var templateSource = $("#device-profile-template").html();
    var template = Handlebars.compile(templateSource);
    $("#device-container").html(template({"devices": deviceArray}));

    updateListeners();

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

initFirebase();
watchDevices();
