function initFirebase() {
  var firebaseConfig = {
    apiKey: "AIzaSyDEHc7ws4S0JeV2HuDvMMjTFqbO-TDkgd8",
    authDomain: "home-dashboard-9604a.firebaseapp.com",
    databaseURL: "https://home-dashboard-9604a.firebaseio.com",
    storageBucket: "home-dashboard-9604a.appspot.com",
  };
  firebase.initializeApp(firebaseConfig);
}

function watchDevices() {
  var deviceList = firebase.database().ref('presences');

  deviceList.on('value', function(snapshot) {

    var deviceList = snapshot.val();
    var deviceArray = [];

    for (var macAddress in deviceList) {
      if (deviceList.hasOwnProperty(macAddress)) {
        var deviceInfo = deviceList[macAddress];

        deviceArray.push({
          macAddress: macAddress,
          lastSeen: moment(deviceInfo.lastSeen).fromNow()
        });
      }
    }

    var templateSource = $("#device-profile-template").html();
    var template = Handlebars.compile(templateSource);
    $("#device-container").html(template({"devices": deviceArray}));

  });
}

initFirebase();
watchDevices();
