# Home Dashboard

Various scrapers & scanners with a web-based dashboard to summarize goings-on in
the home.

## Dependencies

This is intended to run on a Debian-based system like Raspbian, and relies on
the following packages, available via `apt-get`. They're also available on
macOS via `brew`.

  * `arp-scan`

This project requires **NodeJS version 6 or above**. Don't forget to install
Node dependencies for the scanner:

    npm install

## Scanner Setup

### Environment Variables

Secrets are loaded from `.env`. Currently, three are required:

  * `ADMIN_NAME`: the name of the person who should receive system emails
  * `ADMIN_EMAIL`: the email address to which system emails should be addressed
  * `SENDGRID_API_KEY`: the Sendgrid API key to be used to send system emails

These should all be removed in the future when email functionality is moved to
a centralized service.

### Firebase Admin Credentials

The scanner also requires a Firebase Admin private key. These can be generated
in the [Firebase Console](https://console.firebase.google.com/project/home-dashboard-9604a/settings/serviceaccounts/adminsdk)
and should be stored in a file called:

    service-account-creds.json
