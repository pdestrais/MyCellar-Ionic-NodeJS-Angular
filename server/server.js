var express = require("express");
var app = express();
var cors = require('cors')
var cfenv = require("cfenv");
var bodyParser = require('body-parser');
var axios = require('axios');
var HTMLParser = require('fast-html-parser');
var jwt = require('jsonwebtoken');
var crypto = require('crypto');
var https = require('https');
var dotenv = require('dotenv')
  .config();
var jsrender = require('jsrender');
var nodemailer = require('nodemailer');
var environment = require('../package.json');
const json = require("body-parser/lib/types/json");

const length = 128;
const digest = 'sha256';
const gmail = '';

let funB = () => {

  console.log("Hello from funB!");
  return ({
    result: 'ok'
  })
}

let handleError = (caller, error, response) => {
  if (error.response) {
    // The request was made and the server responded with a status code that falls out of the range of 2xx
    //console.log("[NodeJS - /register /create cloudant db]Something went wrong - data : " + error.response.data);
    console.log("[NodeJS - /" + caller + " api]Something went wrong - status : " + error
      .response.status);
    //console.log("[NodeJS - /register /create cloudant db]Something went wrong - status : " + error.response.headers);
    response.status(error.response.status)
      .send(error.response.data)
  } else if (error.request) {
    // The request was made but no response was received `error.request` is an instance of XMLHttpRequest in the browser and an instance of
    // http.ClientRequest in node.js
    console.log("[NodeJS - /" + caller + " api]Something went wrong - request : " + error
      .request);
    response.status(500)
      .send(error.request)
  } else {
    // Something happened in setting up the request that triggered an Error
    console.log("[NodeJS - /" + caller + " api]Something went wrong - message : " + error
      .message);
    response.status(500)
      .send(error.message)
  }
}

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({
  extended: true
}))

// parse application/json
app.use(bodyParser.json())

// Enable CORS
app.use(cors())

app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header('Access-Control-Allow-Methods', 'DELETE, PUT');
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

/* Endpoint to fetch data from Global WIne Score web site. */
app.get("/api/GWS/:appellation/:wine/:year", function (request, response) {
  var appellation = request.params.appellation;
  var wine = request.params.wine;
  var year = request.params.year;
  console.log("[NodeJS - /api/GWS]invoked with param : " + appellation + "/" + wine + "/" +
    year);

  var GWSUrl = "https://www.globalwinescore.com/wine-score/" + wine + "-" + appellation + "/" +
    year;
  var GWScore = {
    score: 0
  };
  console.log("[NodeJS - /api/GWS]" + GWSUrl);
  var _self = this;
  axios.get(GWSUrl)
    .then(res => {
      var root = HTMLParser.parse(res.data);
      let score = root.querySelector('h2.score');
      let firstNode = score.firstChild;
      let rawScoreTxt = firstNode.rawText;
      if (rawScoreTxt.search("not enough data") == -1)
        GWScore.score = parseFloat(rawScoreTxt.trim());

      console.log("[NodeJS - /api/GWS]response : " + JSON.stringify(GWScore));
      response.send(GWScore);
    })
    .catch(error => handleError("GWS", error, response));
});

/* Private endpoint to create user requests (registration or password reset) in user management table. 
    Request body :
    - type(mandatory): either 'Registration' or 'passwordReset'
    One Of
      - username (mandatory)
      - email
      - optional :
        - firstname
        - lastname
        - phone 
        - address
    
      - tempPwd (mandatory)
*/
app.post("/api/createUserMngmtRequest", function (request, response, next) {
  if (!request.body.hasOwnProperty('type') || (request.body.type != 'registration' && request
      .body.type != 'passwordReset')) {
    return response.status(400)
      .send({
        code: 'NoOrInvalidType',
        type: 'technical',
        subtype: 'wrong request parameters',
        resource: '/api/createUserMngmtRequest',
        message: 'No or invalid type'
      });
  }

  if (!request.body.hasOwnProperty('username')) {
    return response.status(400)
      .send({
        code: 'NoUsername',
        type: 'technical',
        subtype: 'missing request parameters',
        resource: '/api/createUserMngmtRequest',
        message: 'No username'
      });
  }

  if (!request.body.hasOwnProperty('email')) {
    return response.status(400)
      .send({
        code: 'NoEMail',
        type: 'technical',
        subtype: 'missing request parameters',
        resource: '/api/createUserMngmtRequest',
        message: 'No email'
      });
  }

  //store user credentials (user,password,salt and other required info) into the database
  var reqData = {
    app: "mycellar",
    type: request.body.type,
    userName: request.body.username,
    email: request.body.email,
    requestDate: new Date()
      .toISOString
  };
  console.log('/createUserMngmtRequest user request data:', JSON.stringify(reqData));
  axios({
      url: 'https://' + process.env.dbHost + '/user-mngt-app',
      method: 'post',
      auth: {
        username: process.env.dbHostServiceUsername,
        password: process.env.dbHostServicePassword
      },
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(JSON.stringify(reqData))
      },
      data: reqData
    })
    .then(res => response.send({
      requestID: res.data.id
    }))
    .catch(error => handleError("createUserMngmtRequest", error, response));
});

// Private endpoint to send a mail to the requestor. 
// request body () :
// - to (mandatory)
// - from (optional)
// - subject (mandatory)
// - message (mandatory)
app.post("/api/sendEMail", function (request, response, next) {
  if (!request.body.hasOwnProperty('subject')) {
    return response.status(400)
      .send({
        code: 'NoSubject',
        type: 'technical',
        subtype: 'Missing request parameters',
        resource: '/api/sendEmail',
        message: 'No Subject to send mail'
      });
  }
  if (!request.body.hasOwnProperty('message')) {
    return response.status(400)
      .send({
        code: 'NoMessage',
        type: 'technical',
        subtype: 'missing request parameters',
        resource: '/api/createUserMngmtRequest',
        message: 'No message'
      });
  }
  if (!request.body.hasOwnProperty('to')) {
    return response.status(400)
      .send({
        code: 'NoEMailAddress',
        type: 'technical',
        subtype: 'missing request parameters',
        resource: '/api/createUserMngmtRequest',
        message: 'No email address'
      });
  }

  let transporter = nodemailer.createTransport({
    host: "smtp.scarlet.be",
    port: 465,
    secure: true,
    auth: {
      user: process.env.mailUserId,
      pass: process.env.mailUserPwd
    }
  });

  let message = {};

  if (!request.body.template) {
    message = {
      from: process.env.emailAdmin,
      to: request.body.to,
      subject: request.body.subject,
      text: request.body.message,
    };
  } else {
    let htmlMessage = jsrender.renderFile('./server/templates/' + request.body.template, request.body.message);
    message = {
      from: process.env.emailAdmin,
      to: request.body.to,
      subject: request.body.subject,
      html: htmlMessage,
    };
  }

  console.log("[sendEMail]mail message : " + JSON.stringify(message));

  transporter.sendMail(message, function (err, res) {
    if (err != null) {
      console.log('mail smtp send message call error returned')
      response.status(500)
        .send(err)
    } else {
      console.log("mail smtp send message call returned without error");
      response.send({
        result: 'OK'
      })
    }
    console.log('send() callback returned: err:', err, '; res:', res);
  })
});

/* Private endpoint to insert or update user data (including password) in the user table.
    Request body :
    - username (mandatory)
    - action (mandatory : either 'create' or 'update')
    - (mandatory) either 
      - password 
      or any of :
      - 
 */
app.post("/api/upsertUserData", function (request, response, next) {

  if (!request.body.hasOwnProperty('username')) {
    return response.status(400)
      .send({
        code: 'NoUsername',
        type: 'technical',
        subtype: 'missing request parameters',
        resource: '/api/upsertUserData',
        message: 'No username'
      });
  }

  if (!request.body.hasOwnProperty('action') || (request.body.action != 'create' && request.body
      .action != 'update')) {
    return response.status(400)
      .send({
        code: 'NoUsername',
        type: 'technical',
        subtype: 'wrong request parameters',
        resource: '/api/upsertUserData',
        message: 'No or invalid action'
      });
  }

  // if action is "create" then we should receive username, email, password & state
  if (!request.body.action == 'create' && (!request.body.hasOwnProperty('password') && !request.body.hasOwnProperty(
      'username') && !request.body.hasOwnProperty('email') && !request.body.hasOwnProperty('state'))) {
    return response.status(400)
      .send({
        code: 'NoUsernameEMailPasswordInCreate',
        type: 'technical',
        subtype: 'wrong request parameters',
        resource: '/api/upsertUserData',
        message: 'You need a username, email, password & state to create a user'
      });
  }

  // if action is "update" then we should at least receive a username
  if (!request.body.action == 'update' && (!request.body.hasOwnProperty('username'))) {
    return response.status(400)
      .send({
        code: 'NoUsernameInUpdate',
        type: 'technical',
        subtype: 'wrong request parameters',
        resource: '/api/upsertUserData',
        message: 'You need at least a username to update a user'
      });
  }

  // fetch user from users table for update
  var selector = {
    "selector": {
      "$and": [{
          "app": "mycellar"
        },
        {
          "username": request.body.username
        }
      ]
    }
  };

  axios({
      url: 'https://' + process.env.dbHost + '/app-users/_find',
      method: 'post',
      auth: {
        username: process.env.dbHostServiceUsername,
        password: process.env.dbHostServicePassword
      },
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(JSON.stringify(selector))
      },
      data: selector
    })
    .then(res => {
      if (res.data.docs.length != 0) {
        // username exists => we can update it but not create it again ...
        if (request.body.action == 'create') {
          return response.status(400)
            .send({
              code: 'UsernameAlReadyExistsInCreate',
              type: 'technical',
              subtype: 'data duplication',
              resource: '/api/upsertUserData',
              message: 'Impossible to create because this username already exists'
            });
        } else {
          // this is an update
          var reqData = {
            app: "mycellar",
            username: request.body.username,
            _id: res.data.docs[0]._id,
            _rev: res.data.docs[0]._rev,
            salt: res.data.docs[0].salt,
            lastname: request.body.lastname || res.data.docs[0].lastname,
            firstname: request.body.firstname || res.data.docs[0].firstname,
            address: request.body.address || res.data.docs[0].address,
            email: request.body.email || res.data.docs[0].email,
            phone: request.body.phone || res.data.docs[0].phone,
            dbServer: process.env.dbHost,
            dbUser: process.env.dbHostServiceUsername,
            dbPassword: process.env.dbHostServicePassword,
            admin: false,
            state: request.body.state || res.data.docs[0].state
          };

          if (request.body.hasOwnProperty('password')) {
            // If a new password is given, it overwrites the existing one
            const salt = crypto.randomBytes(128)
              .toString('base64');
            var hashedPw;
            try {
              hashedPw = crypto.pbkdf2Sync(request.body.password, salt, 10000, length,
                digest);
            } catch (err) {
              return response.status(500)
                .json({
                  error: err
                });
            }
            //store user credentials (user,password,salt and other required info) into the database
            reqData.salt = salt;
            reqData.password = hashedPw.toString('hex');
          } else {
            // If no password is given, this is just an regular update and only the changes of the passed attributes are updated
            reqData.salt = res.data.docs[0].salt;
            reqData.password = res.data.docs[0].password;
          }

          console.log('/upsertUserData update reqData:', JSON.stringify(reqData));
          axios({
              url: 'https://' + process.env.dbHost + '/app-users/' + res.data.docs[0]._id,
              method: 'PUT',
              auth: {
                username: process.env.dbHostServiceUsername,
                password: process.env.dbHostServicePassword
              },
              headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(JSON.stringify(reqData))
              },
              data: reqData
            })
            .then(updateRes => {
              response.json(reqData)
            })
        }

      } else {
        // username doesn't exist => we will create it...
        if (request.body.action == 'create') {
          var reqData = {
            app: "mycellar",
            username: request.body.username,
            lastname: request.body.lastname || "",
            firstname: request.body.firstname || "",
            address: request.body.address || "",
            email: request.body.email || "",
            phone: request.body.phone || "",
            dbServer: process.env.dbHost,
            dbUser: process.env.dbHostServiceUsername,
            dbPassword: process.env.dbHostServicePassword,
            admin: false,
            state: request.body.state || ""
          };

          var newPwd = Math.random()
            .toString(36)
            .slice(-8);

          const salt = crypto.randomBytes(128)
            .toString('base64');

          try {
            hashedPw = crypto.pbkdf2Sync(request.body.password ? request.body.password : newPwd, salt, 10000,
              length,
              digest);
          } catch (err) {
            response.status(500)
              .json({
                error: err
              });
          }
          //store user credentials (user,password,salt and other required info) into the database
          reqData.salt = salt;
          reqData.password = hashedPw.toString('hex');

          console.log('/upsertUserData create reqData:', JSON.stringify(reqData));
          axios({
              url: 'https://' + process.env.dbHost + '/app-users',
              method: 'POST',
              auth: {
                username: process.env.dbHostServiceUsername,
                password: process.env.dbHostServicePassword
              },
              headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(JSON.stringify(reqData))
              },
              data: reqData
            })
            .then(createRes => {
              reqData._id = createRes.id;
              reqData._rev = createRes.rev;
              response.json(reqData);
            })
            .catch(error => handleError("upsertUserData", error, response));
        } else {
          return response.status(401)
            .send({
              code: 'UsernameNotExistInUpdate',
              type: 'technical',
              subtype: 'missing data',
              resource: '/api/upsertUserData',
              message: "User to update doesn't exist"
            });
        }
      }
    })
    .catch(error => handleError("upsertUserData", error, response));

});

// endpoint to receive request for a new signup to the application 
// It will
//    1. create an entry into the registration table
//    2. Send registration confirmation on email address
// request body () :
// username : 
// email: 
// Optional : 
//    lastname: request.body.lastname || "",
//    firstname: request.body.firstname || "",
//    address: request.body.address || "",
//    phone: request.body.phone || ""
app.post("/api/processSignupRequest", function (request, response, next) {
  if (!request.body.hasOwnProperty('email') || !request.body.hasOwnProperty('username')) {
    return response.status(400)
      .send({
        code: 'NoEmailOrUsername',
        type: 'business',
        subtype: 'missing request parameters',
        resource: '/api/processSignupRequest',
        message: 'No email or username'
      });
  }

  // Check that user doesn't already exists before creating a new one
  var selector = {
    "selector": {
      "$and": [{
          "app": "mycellar"
        },
        {
          "username": request.body.username
        }
      ]
    }
  };

  axios({
      url: 'https://' + process.env.dbHost + '/app-users/_find',
      method: 'post',
      auth: {
        username: process.env.dbHostServiceUsername,
        password: process.env.dbHostServicePassword
      },
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(JSON.stringify(selector))
      },
      data: selector
    })
    .then(res => {
      if (res.data.docs.length != 0) {
        // username already exist
        return response.status(409)
          .send({
            code: 'UsernameAlreadyExists',
            type: 'business',
            subtype: 'data duplication',
            resource: '/api/processSignupRequest',
            message: "username " + request.body.username + " already exists"
          });
      } else {
        // prepare create entry into user request table
        var createUserReq = {
          url: 'https://' + process.env.dbHost + '/user-mngt-app/',
          method: 'post',
          auth: {
            username: process.env.dbHostServiceUsername,
            password: process.env.dbHostServicePassword
          },
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(JSON.stringify(selector))
          },
          data: {
            username: request.body.username,
            email: request.body.email,
            lastname: request.body.lastname || "",
            firstname: request.body.firstname || "",
            address: request.body.address || "",
            phone: request.body.phone || "",
            type: 'registration',
            timestamp: new Date()
              .toISOString(),
            app: 'mycellar'
          }
        }
        axios(createUserReq)
          .then(createUserReqResponse => {
            // prepare sending mail
            var sendMailReq = {
              url: process.env.environment == 'dev' ? process.env.apiserver + ':' +
                port + '/api/sendEMail' : process.env.apiserver + '/api/sendEMail',
              method: 'POST',
              data: {
                to: process.env.emailAdmin,
                subject: "Approval user signup request",
                message: {
                  title: 'Approval user signup request',
                  text1: 'Hi Philippe',
                  text2: "You received a new signup request. The user's data are : ",
                  name: request.body.lastName || '',
                  firstname: request.body.firstName || '',
                  username: request.body.username,
                  email: request.body.email,
                  phone: request.body.phone || '',
                  address: request.body.address || '',
                  url: process.env.environment == 'dev' ? process.env.apiserver + ':' + port + '/api/approveUserSignupRequest/' + createUserReqResponse.data.id : process.env.apiserver + '/api/sendEMail' + createUserReqResponse.data.id
                },
                template: "approveReqTmpl.html"
              }
            }
            axios(sendMailReq).then(sendMailRes => {
                return response.status(200)
                  .send({
                    code: "OK",
                    message: "User " + request.body.username + " registered",
                    translateKey: "registrationOK",
                    registrationID: createUserReqResponse.data.id
                  });
              })
              .catch(error => handleError("processSignupRequest/sendMail", error, response))
          })
          .catch(error => handleError("processSignupRequest/createUserRequest", error, response))
      }
    })
    .catch(error => handleError("processSignupRequest/Find user", error, response))
});

// endpoint to the administrator to approval the request for a new signup to the application 
// It will send registration confirmation on email address
app.get("/api/approveUserSignupRequest/:id", function (request, response, next) {

  // fetch request from user-mngmt table correponding to received id
  var reqID = request.params.id;
  if (!reqID)
    return response.status(401)
      .send({
        code: 'NoRegistrationIDParameter',
        type: 'business',
        subtype: 'missing request parameter',
        resource: '/api/approveUserSignupRequest',
        message: 'missing registrationID parameter'
      });

  axios({
      url: 'https://' + process.env.dbHost + '/user-mngt-app/' + reqID,
      method: 'get',
      auth: {
        username: process.env.dbHostServiceUsername,
        password: process.env.dbHostServicePassword
      },
      headers: {
        'Content-Type': 'application/json'
      }
    })
    .then(res => {
      if (res.data) {
        if (res.data.type == 'registration') {
          // if request is for new registration
          // send mail to user to confirm his registration

          var sendMailReq = {
            url: process.env.environment == 'dev' ? process.env.apiserver + ':' +
              port + '/api/sendEMail' : process.env.apiserver + '/api/sendEMail',
            method: 'POST',
            data: {
              to: res.data.email,
              subject: "Confirm your registration request",
              message: {
                title: "Email confirmation",
                text1: "Thank you for signin up to get a myCellar account !!",
                text2: "Before having you on board, please confirm you email address.",
                url: process.env.apiserver + ':' + port + "/api/processUserRequestConfirmation/" + res.data._id
              },
              template: "confirmEmailTmpl.html"
              /*"Click on the following URL to validate the registration request: " + process.env.apiserver + "/api/processUserRequestConfirmation" + res.data.id*/
            }
          }
          axios(sendMailReq)
            .then(sendMailReqResponse => {
              return response.status(200)
                .send({
                  code: "OK",
                  message: "User " + res.data.username + " request approval done",
                  translateKey: "approveRegistrationRequestDONE"
                })
            })
            .catch(error => handleError("approveUserSignupRequest", error, response));
        } else {
          return response.status(401)
            .send({
              code: 'NoRegistrationRequestFound',
              type: 'business',
              subtype: 'No data found',
              resource: '/api/approveUserSignupRequest',
              message: 'No registration request found'
            });
        }
      }
    })
    .catch(error => handleError("approveUserSignupRequest", error, response));
});

// endpoint to finalize the request for a new signup to the application 
// It will
//    1. generate a new password
//    2. create an entry into the user table (with user data and newly generate password - state is registrationDone)
//    3. create Wine Database corresponding to the chosen username
//    4. send mail to user with newly generated password
// request path contains the user request id :
// TODO change name into something more generic like : processRequestConfirmation
app.get("/api/processUserRequestConfirmation/:id", function (request, response, next) {

  // Generate password
  var newPwd = Math.random()
    .toString(36)
    .slice(-8);

  // fetch request from user-mngmt table correponding to received id
  var reqID = request.params.id;
  if (!reqID)
    return response.status(401)
      .send({
        code: 'NoRegistrationIDParameter',
        type: 'business',
        subtype: 'missing request parameter',
        resource: '/api/processUserRequestConfirmation',
        message: 'missing registrationID parameter'
      });

  axios({
      url: 'https://' + process.env.dbHost + '/user-mngt-app/' + reqID,
      method: 'get',
      auth: {
        username: process.env.dbHostServiceUsername,
        password: process.env.dbHostServicePassword
      },
      headers: {
        'Content-Type': 'application/json'
      }
    })
    .then(res => {
      if (res.data) {
        if (res.data.type == 'registration') {
          // if request is for new registration

          var upsertUserDataReq = {
            url: process.env.environment == 'dev' ? process.env.apiserver + ':' +
              port + '/api/upsertUserData' : process.env.apiserver + '/api/upsertUserData',
            method: 'post',
            data: {
              username: res.data.username,
              action: "create",
              password: newPwd,
              lastname: res.data.lastname || "",
              firstname: res.data.firstname || "",
              address: res.data.address || "",
              email: res.data.email || "",
              phone: res.data.phone || "",
              state: 'registrationDone',
              app: 'mycellar'
            }
          }

          axios(upsertUserDataReq)
            .then(upsertRes => {
              // create user table
              var createUserTableReq = {
                url: 'https://' + process.env.dbHostServiceUsername + ":" + process.env
                  .dbHostServicePassword + "@" + process.env.dbHost + '/cellar$' + res
                  .data.username,
                method: 'put',
                auth: {
                  username: process.env.dbHostServiceUsername,
                  password: process.env.dbHostServicePassword
                }
              }
              // send mail
              var sendMailReq = {
                url: process.env.environment == 'dev' ? process.env.apiserver + ':' +
                  port + '/api/sendEMail' : process.env.apiserver + '/api/sendEMail',
                method: 'POST',
                data: {
                  to: res.data.email,
                  subject: "Registration confirmed",
                  message: {
                    title: 'Registration confirmed',
                    text1: "Your registration is now confirmed.",
                    text2: "You can start using the myCellar application.",
                    text3: "Please log on using the following credentials : ",
                    username: res.data.username,
                    pwd: newPwd,
                    url: process.env.apiserver,
                    text4: "You will be asked to immediately change your password after the first login.",
                  },
                  template: "confirmRegistrationTmpl.html"
                }
              }

              axios.all([axios(createUserTableReq), axios(sendMailReq)])
                .then(axios.spread((firstResponse, secondResponse) => {
                  console.log(JSON.stringify(firstResponse.data), JSON.stringify(
                    secondResponse.data));
                  return response.status(200)
                    .send(jsrender.renderFile('./server/templates/confirmRegistrationTmpl.html', sendMailReq.data.message))
                  /*                     .send({
                                        message: "User " + res.data.username + " registration done",
                                        translateKey: "registrationDONE",
                                        password: newPwd
                                      })
                   */
                }))
                .catch(error => handleError("processUserRequestConfirmation (combined)", error, response));
            })
            .catch(error => handleError("processUserRequestConfirmation (combined)", error, response));

        } else {
          // request is for password reset
          // Upsert user with newly generated password
          var upsertUserDataReq = {
            url: process.env.environment == 'dev' ? process.env.apiserver + ':' +
              port + '/api/upsertUserData' : process.env.apiserver + '/api/upsertUserData',
            method: 'post',
            data: {
              username: res.data.username,
              action: 'update',
              password: newPwd,
              state: 'resetPasswordDone'
            }
          }
          // send mail
          var sendMailReq = {
            url: process.env.environment == 'dev' ? process.env.apiserver + ':' +
              port + '/api/sendEMail' : process.env.apiserver + '/api/sendEMail',
            method: 'POST',
            data: {
              to: res.data.email,
              subject: "Password reset confirmed",
              message: {
                title: 'Password reset confirmed',
                text1: "Your password has now been reset.",
                text2: "You can log back in the myCellar application again.",
                text3: "Please use now the following credentials : ",
                username: res.data.username,
                pwd: newPwd,
                url: process.env.apiserver + ':' + port,
                text4: "You will be asked to immediately change your password after the next login.",
              },
              template: "confirmRegistrationTmpl.html"
            }
          }
          axios.all([axios(upsertUserDataReq), axios(sendMailReq)])
            .then(axios.spread((firstResponse, secondResponse) => {
              console.log(JSON.stringify(firstResponse.data), JSON.stringify(
                secondResponse.data));
              return response.status(200)
                .send(jsrender.renderFile('./server/templates/confirmRegistrationTmpl.html', sendMailReq.data.message))
              /*                 .send({
                                message: "User " + res.data.username + " password reset done",
                                translateKey: "passwordResetDONE",
                                password: newPwd
                              })
               */
            }))
            .catch(error => handleError("processUserRequestConfirmation (combined)", error, response));

        }
      } else {
        return response.status(401)
          .send({
            code: 'NoRegistrationRequestFound',
            type: 'business',
            subtype: 'No data found',
            resource: '/api/processUserRequestConfirmation',
            message: 'No registration request found'
          });
      }

    })
    .catch(error => handleError("processUserRequestConfirmation", error, response));
});

// login method
// request body :
// - username
// - password 
// returns either :
// - Error
// - {message, translateKey, user}
app.post('/api/login', function (request, response, next) {

  if (!request.body.hasOwnProperty('username')) {
    return response.status(400)
      .send({
        code: 'NoUsername',
        type: 'business',
        subtype: 'missing request parameters',
        resource: '/api/login',
        message: 'No username'
      });
  }

  if (!request.body.hasOwnProperty('password')) {
    return response.status(400)
      .send({
        code: 'NoPassword',
        type: 'business',
        subtype: 'missing request parameters',
        resource: '/api/login',
        message: 'No password'
      });
  }

  // get user credentials from the database
  var selector = {
    "selector": {
      "$and": [{
          "app": "mycellar"
        },
        {
          "username": request.body.username
        }
      ]
    }
  };

  console.log('login using cloudant db : ' + process.env.dbHost);
  axios({
      url: 'https://' + process.env.dbHost + '/app-users/_find',
      method: 'post',
      auth: {
        username: process.env.dbHostServiceUsername,
        password: process.env.dbHostServicePassword
      },
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(JSON.stringify(selector))
      },
      data: selector
    })
    .then(result => {
      if (result.data.docs.length == 0) {
        return response.status(404)
          .send({
            code: 'LoginUsernameNotExist',
            type: 'business',
            subtype: 'user not found',
            resource: '/api/login',
            message: "username doesn't exist"
          });
      } else {
        // username exist, check if his state is not 'resetPasswordPending' 
        user = result.data.docs[0];
        if (user.state == 'resetPasswordPending') {
          return response.status(400)
            .send({
              code: 'PendingResetPassword',
              type: 'business',
              subtype: 'reset password pending',
              resource: '/api/login',
              message: "A password reset has been requested for this user.  Please complete reset process first."
            });
        } else {
          //compare password with stored hashed value
          user = result.data.docs[0];
          // verify that the password stored in the database corresponds to the given password
          var hash;
          try {
            hash = crypto.pbkdf2Sync(request.body.password, user.salt, 10000, length,
              digest);
          } catch (e) {
            return response.status(500)
              .send({
                error: e
              });
          }
          // check if password is correct by recalculating hash on password and comparing with stored value
          if (hash.toString('hex') === user.password) {
            console.log("password is correct");

            const token = jwt.sign({
              'user': user.username,
              'dbserver': user.dbserver,
              'dbUser': user.dbUser,
              'dbPassword': user.dbPassword,
              permissions: []
            }, process.env.secret, {
              expiresIn: '30d'
            });
            user.token = token;
            delete user.salt;
            if (user.state == 'resetPasswordDone' || user.state == 'registrationDone') {
              return response.status(200)
                .send({
                  code: "changePassword",
                  code_: "changePassword",
                  type: 'business',
                  subtype: 'Force to change password',
                  resource: '/api/login',
                  message: "You are forced to change your password",
                  user: user
                });
            } else {
              return response.status(200)
                .send({
                  code: "OK",
                  type: 'business',
                  subtype: 'Successfull login',
                  resource: '/api/login',
                  message: "You are logged in",
                  user: user
                });
            }
          } else {
            response.status(401)
              .send({
                code: 'BadPassword',
                type: 'business',
                subtype: 'wrong password',
                resource: '/api/login',
                message: "Wrong password"
              });
          }
        }
      }
    })
    .catch(error => handleError("login", error, response));
});

// endpoint to receive request for a password reset request 
// It will
//    1. create an entry into the registration table
//    2. Send registration confirmation on email address
//    3. Update user data status to 'resetPasswordPending'
// request body () :
// - username (mandatory)
app.post("/api/resetPassword", function (request, response, next) {

  if (!request.body.hasOwnProperty('username')) {
    return response.status(400)
      .send({
        code: 'NoUsername',
        type: 'business',
        subtype: 'missing request parameters',
        resource: '/api/resetPassword',
        message: "No username"
      });
  }

  // Check that user exists before registering the request to reset his password
  var query = {
    "selector": {
      "$and": [{
          "app": "mycellar"
        },
        {
          "username": request.body.username
        }
      ]
    },
    "sort": [{
      "timestamp": "desc"
    }]
  };

  axios({
      url: 'https://' + process.env.dbHost + '/user-mngt-app/_find',
      method: 'post',
      auth: {
        username: process.env.dbHostServiceUsername,
        password: process.env.dbHostServicePassword
      },
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(JSON.stringify(query))
      },
      data: query
    })
    .then(res => {
      if (res.data.docs.length != 0) {
        // we take the last created entry that corresponds to the lastest request done by the user
        let userRequest = res.data.docs[0];
        // prepare create user request
        var createUserReq = {
          url: 'https://' + process.env.dbHost + '/user-mngt-app/',
          method: 'post',
          auth: {
            username: process.env.dbHostServiceUsername,
            password: process.env.dbHostServicePassword
          },
          headers: {
            'Content-Type': 'application/json'
          },
          data: {
            username: request.body.username,
            email: userRequest.email,
            type: 'pwdReset',
            timestamp: new Date()
              .toISOString(),
            app: 'mycellar'
          }
        }
        // prepare sending mail to user
        var sendMailReq = {
          url: process.env.environment == 'dev' ? process.env.apiserver + ':' +
            port + '/api/sendEMail' : process.env.apiserver + 'api/sendEMail',
          method: 'POST',
          data: {
            to: userRequest.email,
            subject: "Confirm your password reset request",
            message: {
              title: "Confirm Password Reset  confirmation",
              text1: "We received your request to reset your password.",
              text2: "For security reasons, we want to check that you are the originator of this request.",
              url: process.env.apiserver + ':' + port + "/api/processUserRequestConfirmation/" + userRequest._id
            },
            template: "confirmEmailTmpl.html"
          }
        }
        // prepare user state update 
        var updateUserDataReq = {
          url: process.env.environment == 'dev' ? process.env.apiserver + ':' +
            port + '/api/upsertUserData' : process.env.apiserver + 'api/upsertUserData',
          method: 'POST',
          data: {
            action: 'update',
            username: userRequest.username,
            state: 'resetPasswordPending'
          }
        }

        axios.all([axios(createUserReq), axios(sendMailReq), axios(updateUserDataReq)])
          .then(axios.spread((firstResponse, secondResponse, thirdResponse) => {
            console.log(JSON.stringify(firstResponse.data), JSON.stringify(
              secondResponse.data), JSON.stringify(thirdResponse.data));
            return response.status(200)
              .send({
                code: "OK",
                message: "User " + request.body.username + "  password reset received",
                translateKey: "pwdResetRequestOK",
                registrationID: firstResponse.data.id
              });
          }))
          .catch(error => handleError("resetPassword (combined)", error, response));

      } else {
        return response.status(404)
          .send({
            code: 'UsernameNotExist',
            type: 'business',
            subtype: 'user not found',
            resource: '/api/resetPassword',
            message: "username doesn't exist"
          });
      }
    })
    .catch(error => handleError("resetPassword", error, response));
});

// changePassword method
// request body :
// - username
// - oldPassword
// - newPassword
// returns either :
// - Error
// - {message, translateKey}
app.post('/api/changePassword', function (request, response, next) {

  if (!request.body.hasOwnProperty('username')) {
    return response.status(400)
      .send({
        code: 'NoUsername',
        type: 'technical',
        subtype: 'missing request parameters',
        resource: '/api/changePassword',
        message: "No username"
      });
  }

  if (!request.body.hasOwnProperty('oldPassword')) {
    return response.status(400)
      .send({
        code: 'NoPreviousPassword',
        type: 'technical',
        subtype: 'missing request parameters',
        resource: '/api/changePassword',
        message: "No previous password"
      });
  }

  if (!request.body.hasOwnProperty('newPassword')) {
    return response.status(400)
      .send({
        code: 'NoNewPassword',
        type: 'Technical',
        subtype: 'missing request parameters',
        resource: '/api/changePassword',
        message: "No new password"
      });
  }

  // get user credentials from the database
  var selector = {
    "selector": {
      "$and": [{
          "app": "mycellar"
        },
        {
          "username": request.body.username
        }
      ]
    }
  };

  axios({
      url: 'https://' + process.env.dbHost + '/app-users/_find',
      method: 'post',
      auth: {
        username: process.env.dbHostServiceUsername,
        password: process.env.dbHostServicePassword
      },
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(JSON.stringify(selector))
      },
      data: selector
    })
    .then(result => {
      if (result.data.docs.length == 0) {
        return response.status(404)
          .send({
            code: 'UsernameNotExist',
            type: 'technical',
            subtype: 'user not found',
            resource: '/api/changePassword',
            message: "username doesn't exist"
          });
      } else {
        // username exist, compare password with stored hashed value
        user = result.data.docs[0];
        // verify that the password stored in the database corresponds to the given password
        var hash;
        try {
          hash = crypto.pbkdf2Sync(request.body.oldPassword, user.salt, 10000, length,
            digest);
        } catch (e) {
          return response.status(500)
            .send({
              error: e
            });
        }
        // check if password is correct by recalculating hash on password and comparing with stored value
        if (hash.toString('hex') === user.password) {
          console.log("old password is correct");
          if (user.state == 'resetPasswordPending') {
            return response.status(403)
              .send({
                code: 'PendingResetPassword',
                type: 'business',
                subtype: 'reset password pending',
                resource: '/api/changePassword',
                message: "A password reset has been requested for this user.  Please complete reset process first."
              });
          } else {
            // Update user 's data state to "standard" and change password
            var upsertUserDataReq = {
              url: process.env.environment == 'dev' ? process.env.apiserver + ':' +
                port + '/api/upsertUserData' : process.env.apiserver + '/api/upsertUserData',
              method: 'post',
              data: {
                username: request.body.username,
                action: 'update',
                password: request.body.newPassword,
                state: 'standard'
              }
            }

            axios(upsertUserDataReq)
              .then(upsertRes => {
                return response.status(200)
                  .send({
                    code: "OK",
                    message: "change password succesfull",
                    translateKey: "updateUserPasswordOK",
                    user: user
                  });
              })
              .catch(error => handleError("changePassword", error, response));

          }
        } else {
          response.status(401)
            .send({
              code: 'BadPassword',
              type: 'business',
              subtype: 'wrong password',
              resource: '/api/changePassword',
              message: "Wrong password"
            });
        }

      }
    })
    .catch(error => handleError("changePassword", error, response));
});

// updateUserData method
// request body :
// - username (mandatory)
// - lastname
// - firstname
// - address
// - email
// - phone
// returns either :
// - Error
// - {message "update user data successfull", translateKey}
app.post('/api/updateUserData', function (request, response, next) {

  if (!request.body.hasOwnProperty('username')) {
    return response.status(400)
      .send({
        code: 'NoUsername',
        type: 'technical',
        subtype: 'missing request parameters',
        resource: '/api/updateUserData',
        message: "No username"
      });
  }

  var upsertUserDataReq = {
    url: process.env.environment == 'dev' ? process.env.apiserver + ':' +
      port + '/api/upsertUserData' : process.env.apiserver + '/api/upsertUserData',
    method: 'post',
    data: {
      username: request.body.username,
      action: "update",
      lastname: request.body.lastname || "",
      firstname: request.body.firstname || "",
      address: request.body.address || "",
      email: request.body.email || "",
      phone: request.body.phone || "",
      state: 'standard'
    }
  }

  axios(upsertUserDataReq)
    .then(upsertRes => {
      return response.status(200)
        .send({
          code: 'OK',
          message: "update user data successfull",
          translateKey: "updateUserDataOK",
          user: upsertRes.data
        });
    })
    .catch(error =>
      handleError("updateUserData", error, response)
    );

});

// endpoint to 
//    1. Create the user into the app - users db and 
//    2. create a new database 'cellar${username}' into cloudant
// request body () :
// username :
// password: 
// email: 
// Optional : 
//    lastname: request.body.lastname || "",
//    firstname: request.body.firstname || "",
//    address: request.body.address || "",
//    phone: request.body.phone || ""
app.post("/api/register", function (request, response, next) {
  if (!request.body.hasOwnProperty('password')) {
    let err = new Error('No password');
    return next(err);
  }

  if (!request.body.hasOwnProperty('username')) {
    let err = new Error('No user name');
    return next(err);
  }

  // Check that user deosn't already exists before creating a new one
  var selector = {
    "selector": {
      "$and": [{
          "app": "mycellar"
        },
        {
          "username": request.body.username
        }
      ]
    }
  };

  axios({
      url: 'https://' + process.env.dbHost + '/app-users/_find',
      method: 'post',
      auth: {
        username: process.env.dbHostServiceUsername,
        password: process.env.dbHostServicePassword
      },
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(JSON.stringify(selector))
      },
      data: selector
    })
    .then(res => {
      if (res.data.docs.length != 0) {
        // username already exist
        response.send("username " + request.body.username + " already exists");
      } else {
        axios.post("http://localhost:" + port + "/api/createUserInAppUsersTable", {
            data: {
              username: request.body.username,
              password: request.body.password,
              lastname: request.body.lastname || "",
              firstname: request.body.firstname || "",
              address: request.body.addres || "",
              email: request.body.email || "",
              phone: request.body.phone || ""
            }
          })
          .then(res => {
            if (res.data.doc) {
              // Call Cloudant API to create a cellar database for the user
              var url = 'https://' + process.env.dbHostServiceUsername + ":" + process.env
                .dbHostServicePassword + "@" + process.env.dbHost + '/cellar$' + request
                .body.username;
              axios(url, {
                  url: url,
                  method: 'put',
                  auth: {
                    username: process.env.dbHostServiceUsername,
                    password: process.env.dbHostServicePassword
                  }

                })
                .then(res => {
                  response.send({
                    message: "User " + request.body.username + " registered",
                    translateKey: "registrationOK"
                  });
                })
                .catch(error => {
                  if (error.response) {
                    // The request was made and the server responded with a status code
                    // that falls out of the range of 2xx
                    //console.log("[NodeJS - /register /create cloudant db]Something went wrong - data : " + error.response.data);
                    console.log(
                      "[NodeJS - /register /create cloudant db]Something went wrong - status : " +
                      error.response.status);
                    //console.log("[NodeJS - /register /create cloudant db]Something went wrong - status : " + error.response.headers);
                    response.status(error.response.status)
                      .send(error.message)
                  } else if (error.request) {
                    // The request was made but no response was received
                    // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
                    // http.ClientRequest in node.js
                    console.log(
                      "[NodeJS - /register /create cloudant db]Something went wrong - request : " +
                      error.request);
                    response.status(500)
                      .send(error.request)
                  } else {
                    // Something happened in setting up the request that triggered an Error
                    console.log(
                      "[NodeJS - /register /create cloudant db]Something went wrong - message : " +
                      error.message);
                    response.status(500)
                      .send(error.message)
                  }
                });
            }
          })
          .catch(err => {
            if (err.response) {
              // The request was made and the server responded with a status code
              // that falls out of the range of 2xx
              console.log("[NodeJS - /register]Something went wrong - status : " + err
                .response.status);
              response.status(err.response.status)
                .send(err.message);
            } else if (err.request) {
              // The request was made but no response was received
              // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
              // http.ClientRequest in node.js
              console.log(
                "[NodeJS - /register]Something went wrong - no response from server : " +
                err.request);
              response.status(500)
                .send(err.message);
            } else {
              // Something happened in setting up the request that triggered an Error
              console.log("[NodeJS - /register]Something went wrong in the NodeJs proxy: " +
                err.message);
              response.status(500)
                .send(err.message);
            }
          });

      }
    })
    .catch(error => {
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        //console.log("[NodeJS - /register /create cloudant db]Something went wrong - data : " + error.response.data);
        console.log(
          "[NodeJS - /register /create cloudant db]Something went wrong - status : " + error
          .response.status);
        //console.log("[NodeJS - /register /create cloudant db]Something went wrong - status : " + error.response.headers);
        response.status(error.response.status)
          .send(error.message)
      } else if (error.request) {
        // The request was made but no response was received
        // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
        // http.ClientRequest in node.js
        console.log(
          "[NodeJS - /register /create cloudant db]Something went wrong - request : " +
          error.request);
        response.status(500)
          .send(error.request)
      } else {
        // Something happened in setting up the request that triggered an Error
        console.log(
          "[NodeJS - /register /create cloudant db]Something went wrong - message : " +
          error.message);
        response.status(500)
          .send(error.message)
      }
    });
});

// endpoint to send a mail to philippe.destrais@gmail.com with user data for creation of new user by an application administrator. 
// request body () :
// - username :
// - password: 
// - email: 
app.post("/api/registerViaMail", function (request, response, next) {
  if (!request.body.hasOwnProperty('password')) {
    let err = new Error('No password');
    return next(err);
  }
  if (!request.body.hasOwnProperty('username')) {
    let err = new Error('No user name');
    return next(err);
  }
  if (!request.body.hasOwnProperty('email')) {
    let err = new Error('No user email');
    return next(err);
  }

  var send = require('gmail-send')({
    //var send = require('../index.js')({
    user: process.env.userId,
    // user: credentials.user,                  // Your GMail account used to send emails
    pass: process.env.mailUserPwd,
    // pass: credentials.pass,                  // Application-specific password
    //to: 'user@gmail.com',
    // to:   credentials.user,                  // Send to yourself
    // you also may set array of recipients:
    // [ 'user1@gmail.com', 'user2@gmail.com' ]
    // from:    credentials.user,            // from: by default equals to user
    // replyTo: credentials.user,            // replyTo: by default undefined
    // bcc: 'some-user@mail.com',            // almost any option of `nodemailer` will be passed to it
    subject: 'test subject',
    text: 'gmail-send example 1', // Plain text
    //html:    '<b>html text</b>'            // HTML
  });

  send({
    to: 'philippe.destrais@gmail.com',
    subject: 'Mycellar registration',
    text: 'username: ' + request.body.username + '\npassword: ' + request.body.password +
      '\nemail: ' + request.body.email + '\n: ' + request.body.email + '\nfirst name: ' +
      request.body.firstName + '\nlast name: ' + request.body.lastName
  }, function (err, res) {
    if (err != null) {
      console.log('gmail send message call error returned')
      response.status(500)
        .send(err)
    } else {
      console.log("gmail send message call returned without error");
      response.send({
        result: 'OK'
      })
    }
    console.log('send() callback returned: err:', err, '; res:', res);
  });
});

/* Endpoint to create user in users table and encrypt given password with generated salt. Salt and password are stored. 
    Request body :
    - username (mandatory)
    - password (mandatory)
    - optional :
      - email
      - firstname
      - lastname
      - phone 
      - address
*/
app.post("/api/createUserInAppUsersTable", function (request, response, next) {
  if (!request.body.data.hasOwnProperty('password')) {
    let err = new Error('No password');
    return next(err);
  }

  if (!request.body.data.hasOwnProperty('username')) {
    let err = new Error('No user name');
    return next(err);
  }

  const salt = crypto.randomBytes(128)
    .toString('base64');

  var hashedPw;
  try {
    hashedPw = crypto.pbkdf2Sync(request.body.data.password, salt, 10000, length, digest);
  } catch (err) {
    response.status(500)
      .json({
        error: err
      });
  }
  //store user credentials (user,password,salt and other required info) into the database
  var reqData = {
    app: "mycellar",
    username: request.body.data.username,
    password: hashedPw.toString('hex'),
    salt: salt,
    lastname: request.body.data.lastname || "",
    firstname: request.body.data.firstname || "",
    address: request.body.data.addres || "",
    email: request.body.data.email || "",
    phone: request.body.data.phone || "",
    admin: false
  };
  var options = {
    host: process.env.dbHost,
    path: '/app-users',
    method: 'POST',
    rejectUnauthorized: false,
    auth: process.env.dbHostServiceUsername + ":" + process.env.dbHostServicePassword,
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(JSON.stringify(reqData))
    }
  };
  console.log('/registration data:', JSON.stringify(reqData));

  var req = https.request(options, (res) => {
    //console.log('statusCode:', res.statusCode);
    //console.log('headers:', res.headers);
    var body = '';
    res.on('data', (d) => {
      body += d;
      process.stdout.write(d);
    });
    res.on('end', function () {
      // Data reception is done, do whatever with it!
      //console.log("before parsing - body : "+body);
      var parsed = {};
      try {
        parsed = JSON.parse(body);
      } catch (e) {
        parsed = {};
        console.log("error parsing result");
      }
      response.json({
        doc: parsed
      });
    });
  });

  req.on('error', (e) => {
    console.error("Node Server Request got error: " + e.message);
  });
  req.write(JSON.stringify(reqData));
  req.end();
});

/* Endpoint to update user data (including password) in the user table.
    Request body :
    - username (mandatory)
    - (mandatory) either 
      - password 
      or any of :
      - email
      - firstname
      - lastname
      - phone
      - address
 */
app.post("/api/changeUserDataInUsersTable", function (request, response, next) {

  if (!request.body.data.hasOwnProperty('username')) {
    let err = new Error('No user name');
    return next(err);
  }

  if (!request.body.data.hasOwnProperty('password') &&
    !(request.body.data.hasOwnProperty('email') ||
      request.body.data.hasOwnProperty('firstname') ||
      request.body.data.hasOwnProperty('lastname') ||
      request.body.data.hasOwnProperty('phone') ||
      request.body.data.hasOwnProperty('address'))
  ) {
    let err = new Error('No password or no other user data to update');
    return next(err);
  }

  // fetch user from users table for update
  var selector = {
    "selector": {
      "$and": [{
          "app": "mycellar"
        },
        {
          "username": request.body.username
        }
      ]
    }
  };

  axios({
      url: 'https://' + process.env.dbHost + '/app-users/_find',
      method: 'post',
      auth: {
        username: process.env.dbHostServiceUsername,
        password: process.env.dbHostServicePassword
      },
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(JSON.stringify(selector))
      },
      data: selector
    })
    .then(res => {
      if (res.data.docs.length != 0) {
        // username exists => we can update it...
        if (request.body.data.hasOwnProperty('password')) {
          const salt = crypto.randomBytes(128)
            .toString('base64');
          var hashedPw;
          try {
            hashedPw = crypto.pbkdf2Sync(request.body.data.password, salt, 10000, length,
              digest);
          } catch (err) {
            response.status(500)
              .json({
                error: err
              });
          }
          //store user credentials (user,password,salt and other required info) into the database
          var reqData = {
            app: "mycellar",
            username: request.body.data.username,
            password: hashedPw.toString('hex'),
            salt: salt,
            _id: res.data.docs[0]._id,
            lastname: res.data.docs[0].lastname,
            firstname: res.data.docs[0].firstname,
            address: res.data.docs[0].addres,
            email: res.data.docs[0].email,
            phone: res.data.docs[0].phone,
            admin: false
          };
        } else {
          var reqData = {
            app: "mycellar",
            username: request.body.data.username,
            password: res.data.docs[0].password,
            salt: res.data.docs[0].salt,
            lastname: request.body.data.lastname || "",
            firstname: request.body.data.firstname || "",
            address: request.body.data.addres || "",
            email: request.body.data.email || "",
            phone: request.body.data.phone || "",
            admin: false
          };
        }

        var options = {
          host: process.env.dbHost,
          path: '/app-users',
          method: 'POST',
          rejectUnauthorized: false,
          auth: process.env.dbHostServiceUsername + ":" + process.env.dbHostServicePassword,
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(JSON.stringify(reqData))
          }
        };
        console.log('/registration data:', JSON.stringify(reqData));

        var req = https.request(options, (res) => {
          //console.log('statusCode:', res.statusCode);
          //console.log('headers:', res.headers);
          var body = '';
          res.on('data', (d) => {
            body += d;
            process.stdout.write(d);
          });
          res.on('end', function () {
            // Data reception is done, do whatever with it!
            //console.log("before parsing - body : "+body);
            var parsed = {};
            try {
              parsed = JSON.parse(body);
            } catch (e) {
              parsed = {};
              console.log("error parsing result");
            }
            response.json({
              doc: parsed
            });
          });
        });

        req.on('error', (e) => {
          console.error("Node Server Request got error: " + e.message);
        });
        req.write(JSON.stringify(reqData));
        req.end();

      } else {
        response.send("username : " + request.body.username + " doesn't exist");
      }
    })
    .catch(error => {
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        //console.log("[NodeJS - /register /create cloudant db]Something went wrong - data : " + error.response.data);
        console.log(
          "[NodeJS - /changeUserPasswordInUsersTable api]Something went wrong - status : " +
          error.response.status);
        //console.log("[NodeJS - /register /create cloudant db]Something went wrong - status : " + error.response.headers);
        response.status(error.response.status)
          .send(error.message)
      } else if (error.request) {
        // The request was made but no response was received
        // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
        // http.ClientRequest in node.js
        console.log(
          "[NodeJS - /changeUserPasswordInUsersTable api]Something went wrong - request : " +
          error.request);
        response.status(500)
          .send(error.request)
      } else {
        // Something happened in setting up the request that triggered an Error
        console.log(
          "[NodeJS - /changeUserPasswordInUsersTable api]Something went wrong - message : " +
          error.message);
        response.status(500)
          .send(error.message)
      }
    });

});

// login method
// request body :
// username :
// password : 
app.post('/api/loginold', function (request, response, next) {

  // get user credentials from the database
  var selector = {
    "selector": {
      "$and": [{
          "app": "mycellar"
        },
        {
          "username": request.body.username
        }
      ]
    }
  };

  var options = {
    host: process.env.dbHost,
    path: '/app-users/_find',
    method: 'POST',
    rejectUnauthorized: false,
    auth: process.env.dbHostServiceUsername + ":" + process.env.dbHostServicePassword,
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(JSON.stringify(selector))
    }
  };
  console.log('/login selector :', JSON.stringify(selector));

  var req = https.request(options, (res) => {
    //console.log('statusCode:', res.statusCode);
    //console.log('headers:', res.headers);
    var body = '';
    res.on('data', (d) => {
      body += d;
      process.stdout.write(d);
    });
    res.on('end', function () {
      // Data reception is done, do whatever with it!
      //console.log("before parsing - body : "+body);
      var parsed = {};
      try {
        parsed = JSON.parse(body);
        var user = parsed.docs[0];
        if (user) {
          // verify that the password stored in the database corresponds to the given password
          var hash;
          try {
            hash = crypto.pbkdf2Sync(request.body.password, user.salt, 10000, length,
              digest);
          } catch (e) {
            response.json({
              error: e
            });
          }
          // check if password is correct by recalculating hash on password and comparing with stored value
          if (hash.toString('hex') === user.password) {
            console.log("password is correct");
            const token = jwt.sign({
              'user': user.username,
              permissions: []
            }, process.env.secret, {
              expiresIn: '30d'
            });
            user.token = token;
            delete user.salt;
            response.json(user);

          } else {
            response.json({
              message: 'Wrong password',
              translateKey: 'BadPassword'
            });
          }
        } else {
          response.json({
            message: "username doesn't exist",
            translateKey: 'NoUsername'
          })
        }
      } catch (e) {
        parsed = {};
        console.log("error parsing result");
      }
      //response.json({
      //  doc: parsed
      //});
    });
  });

  req.on('error', (e) => {
    console.error("Node Server Request got error: " + e.message);
  });
  req.write(JSON.stringify(selector));
  req.end();

});

app.get("/api/ping", function (request, response, next) {
  resp = {
    status: 'backend API server available',
    environment: {
      dbHost: process.env.dbHost,
      dbHostServiceUsername: process.env.dbHostServiceUsername,
      secret: process.env.secret,
      mailUserId: process.env.mailUserId
    },
    backendVersion: environment.version
  }
  response.json(resp);

})

//serve static file (index.html, images, css)
app.use(express.static(__dirname + '/../client/www'));

app.get('*', function (request, response) {
  response.sendFile('index.html', {
    root: './client/www'
  });
});

var port = process.env.PORT || 5001
app.listen(port, function () {
  console.log("To view your app, open this link in your browser: http://localhost:" + port);
});