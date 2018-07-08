GDPR-coordinator
===================
This app coordinates the GDPR right to be forgotten(RTBF) proccess between multiple systems to keep us General Data Protection Regulation (GDPR) compliant.

Developer notes
-------------

* Code is not as clean as i would like due to a hard deadline
* I chose to concentrate on getting a full suite of tests in place as this will allow any developer to refactor the code with a safety net.
* Developed using TDD
* The tests are a mix of unit tests and integration tests.
* Pure integration tests are in the in integration test folder.
    * The integration tests only cover the node app. They do not send real requests to hybris/NAV etc.
* Mockgoose is used to mock out mongoose/mongodb.
* Fetch-mock is used to mock out fetch requests.
* Supertest is use to send integration test queries

**The app has the following flow:**

1. Salesforce setups up a requests for RTBF.
2. Node app has a cron job built in that will pull the requests from salesforce
3. Node marks to job as INITIATED and then forwards the request to Hybris and changed the state to SENT_TO_HYBRIS.
4. Node sends an acknowledgement to Salesforce to indicate the process has started.
5. Hybris will send an update to /updateRTBFStates to change the state to "PROCESSED_IN_HYBRIS" when it has completed its annoymisation
6. When PROCESSED_IN_HYBRIS is recieved node will look up the next allowed state change and will forward on the request to etc.
7. When all systems have been completed the node app sends a request to Salesforce to Aonymise the data its hold.
8. when Saleforce completed its work it adds the request to a list of completedRTBF requests.
9. Node pulls the completedRTBF requests and then encrypts the email address in its own audit logs and the process is complete

Daily Reminder job
-------------
The node app has an inbuilt cron job that generates a reminder email.

It will look at all non completed requests that are older than X days and send an email to app support.

Errors
-------------
If an error occurs then an email will be sent to app support.

At the time of writing app support will just find a developer to look into the issue.

Setup and commands
-------------
```javascript
nvm use 4
npm install
npm start

npm run test
npm run test-watch
```
