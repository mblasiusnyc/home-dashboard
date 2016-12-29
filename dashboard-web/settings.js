USER_ID = null;
USER_PROFILE = null;

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

function setManagedPlace(newPlaceId) {
  return firebase.database().ref("users/" + USER_ID + "/placeBeingManaged").set(newPlaceId);
}



/**
 * SELECT A PLACE
 */



function showSetupPlaceFlow(places, noDevicesReason) {
  // populate page structure
  var placeListSource = $("#place-list-template").html();
  var placeListTemplate = _.template(placeListSource);
  $("#place-list-container").html(placeListTemplate({"places": places, "noDevicesReason": noDevicesReason}));
  updatePlacesListeners();
}

function showSelectPlaceFlow() {
  // build page structure
  var templateSource = $("#select-place-template").html();
  var placeTemplate = _.template(templateSource);
  $("#content").html(placeTemplate());

  var placeList = null;

  firebase.database().ref("places").on("value", function(placesSnapshot) {
    placeList = placesSnapshot.val();

    if (placeList) {
      // populate page structure
      var placeListSource = $("#place-list-template").html();
      var placeListTemplate = _.template(placeListSource);
      $("#place-list-container").html(placeListTemplate({"places": placeList}));

      updatePlacesListeners();
    } else {
      /* Three options:
       *
       * No device on the network of any kind - display instructions to set up a device
       * Device on the network that's already in use - user can join Place
       * Unclaimed device on the network - display UI to initialize it
      */

      // get IP address
      $.getJSON("//api.ipify.org?format=json")
        .done(function(result) {
          placeList = {};
          var ipAddress = result.ip.trim();

          var noDevicesReason = {
            "noDevicesFound": false,
            "claimedDeviceAvailable": false,
            "unclaimedDeviceAvailable": false
          };

          // look up scanners with the same IP address
          firebase.database().ref("/scanners").orderByChild("ipAddress").equalTo(ipAddress).once("value", function(scannerSnapshot) {
            var nearbyScanners = scannerSnapshot.val();

            // TODO: handle multiple active scanners on the same network

            if (nearbyScanners && scannerSnapshot.key) {
              // look up places attached to this scanner
              firebase.database().ref("/places").orderByChild("scannerId").equalTo(scannerSnapshot.key).once("value", function(placeSnapshot) {
                // place exists attached to this scanner
                var nearbyClaimedScanners = placeSnapshot.val();

                if (nearbyClaimedScanners) {
                  console.log("claimedDeviceAvailable");
                  noDevicesReason.claimedDeviceAvailable = true;
                  noDevicesReason["deviceId"] = Object.keys(nearbyClaimedScanners)[0];

                  showSetupPlaceFlow(placeList, noDevicesReason);
                } else {
                  // no places attached to this scanner
                  console.log("unclaimedDeviceAvailable");
                  noDevicesReason.unclaimedDeviceAvailable = true;
                  noDevicesReason["deviceId"] = Object.keys(nearbyScanners)[0];

                  showSetupPlaceFlow(placeList, noDevicesReason);
                }
              });
            } else {
              // no scanners matching this IP address
              console.log("noDevicesFound");
              noDevicesReason.noDevicesFound = true;

              showSetupPlaceFlow(placeList, noDevicesReason);
            }
          });
        })
        .fail(function() {
          var failedToLocateSource = $("#failed-to-locate-template").html();
          var failedToLocateTemplate = _.template(failedToLocateSource);
          $("#place-list-container").html(failedToLocateTemplate());
        });
    }
  });
}

function updatePlacesListeners() {
  $(".setup-scanner-button").unbind().on("click", function() {
    var newPlaceName = prompt("Name your current location:");
    var scannerId = $(this).data("scanner-id");

    var usersObject = {};
    usersObject[USER_ID] = true;

    var newPlaceId = firebase.database().ref("places").push({
      "name" : newPlaceName,
      "scannerId": scannerId,
      "users": usersObject
    }).key;

    setManagedPlace(newPlaceId);
    initAuth(initSettingsFlow);
  });

  $(".manage-place-button").unbind().on("click", function() {
    var placeId = $(this).data("place-id");

    setManagedPlace(placeId);
    initAuth(initSettingsFlow);
  });
}



/**
 * NETWORK DEVICES
 */


function updateDeviceListeners() {
  $("button.edit-device-name").unbind().on('click', function() {
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

  $("button.hide-device").unbind().on('click', function() {
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

  $("button.show-device").unbind().on('click', function() {
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

  $("button.change-place-button").unbind().on("click", function() {
    firebase.database().ref("users/" + USER_ID + "/placeBeingManaged").set(0, function() {
      initAuth(initSettingsFlow);
    });
  });
}

function watchDevices() {
  var place = null;

  console.log("Attempting to manage", "places/" + USER_PROFILE["placeBeingManaged"]);

  firebase.database().ref("places/" + USER_PROFILE["placeBeingManaged"]).once("value", function(snapshot) {
    place = snapshot.val();

    if (place) {
      firebase.database().ref('devices').on('value', function(snapshot) {
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

        // build page structure
        var structureTemplateSource = $("#manage-device-template").html();
        var structureTemplate = _.template(structureTemplateSource);
        $("#content").html(structureTemplate({"placeName": place.name}));

        // populate page structure
        var templateSource = $("#device-profile-template").html();

        var shownTemplate = Handlebars.compile(templateSource);
        $("#shown-device-container").html(shownTemplate({"devices": shownDevices}));

        var hiddenTemplate = Handlebars.compile(templateSource);
        $("#hidden-device-container").html(shownTemplate({"devices": hiddenDevices}));

        updateDeviceListeners();
      });
    }
  }, function() {
    // no such place exists (or we can't see it)

    console.log("Invalid place - resetting state");

    if (place === null) {
      firebase.database().ref("users/" + USER_ID).transaction(function(profile) {
        profile["placeBeingManaged"] = 0;
        return profile;
      });

      initAuth(initSettingsFlow);
    }
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


/**
 * AUTHENTICATION
 */


function initAuth(callbackWhenLoggedin) {
  firebase.auth().onAuthStateChanged(function(user) {
    if ( ! user) {
      window.location.href="/login.html";
    } else {
      USER_ID = user.uid;

      firebase.database().ref("users").child(USER_ID).once("value", function(snapshot) {
        USER_PROFILE = snapshot.val();

        // check for malformed data... we can't do much if we don't have userdata
        if (USER_PROFILE === null) {
          firebase.auth().signOut();
          return;
        }

        callbackWhenLoggedin();
      });
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

function cleanupListeners() {
  firebase.database().ref("devices").off();
  firebase.database().ref("places").off();
}

function initSettingsFlow() {
  cleanupListeners();

  if (typeof USER_PROFILE.placeBeingManaged !== "undefined" && USER_PROFILE.placeBeingManaged) {
    console.log("watchDevices()");
    watchDevices();
  } else {
    console.log("showSelectPlaceFlow()");
    showSelectPlaceFlow();
  }
}


/**
 * INITIALIZATION - WHERE EVERYTHING STARTS
 */


initFirebase();
initAuth(initSettingsFlow);
initUI();
