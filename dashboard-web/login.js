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


/**
 * AUTH
 */


function initAuth() {
  // if we're logged in, skip this page
  firebase.auth().onAuthStateChanged(function(user) {
    if (user) {
      window.location.href="/";
    }
  });
}


/**
 * FORM SUBMISSION
 */


function initUIListeners() {
  console.log("form: ", $("#login-form"));

  $('#login-form').on('submit', function(event) {
    event.preventDefault();
    $("#error-container").html('');

    console.debug('Form submitted');

    var email = $('#email').val();
    var password = $('#password').val();

    firebase.auth().signInWithEmailAndPassword(email, password).catch(function (error) {
      console.debug(error);
      var errorType = error.code;
      var errorMessage = null;

      switch (errorType) {
        case 'auth/user-not-found':
        case 'auth/wrong-password':
          errorMessage = 'No user was found with those credentials.';
          break;

        case 'auth/invalid-email':
          errorMessage = 'That email address doesn\'t look right.';
          break;

        default:
          errorMessage = 'Something went wrong... try again in a few minutes.';
      }

      showError(errorMessage);
    });
  });
}

function showError(errorMessage) {
  var templateSource = $("#form-error-template").html();
  var template = Handlebars.compile(templateSource);
  $('#error-container').html(template({"errorMessage": errorMessage}));
}


/**
 * INITIALIZATION - WHERE EVERYTHING STARTS
 */


initFirebase();
initAuth();
initUIListeners();
