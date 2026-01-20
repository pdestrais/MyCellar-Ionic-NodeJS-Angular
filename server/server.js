const CONFIG = require("./config.json");
const { getS3, getS3Hmac } = require("./s3/s3Client");
const { findBucketEndpoint, getEndpoints } = require("./s3/endpoints");
const {
  putObject,
  putImage,
  putObjects,
  getObject,
  headObject,
  deleteObject,
} = require("./s3/object");
const { listBuckets, listObjects } = require("./s3/bucket");

var express = require("express");
const multer = require("multer");
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
var compression = require("compression");
var app = express();
var cors = require("cors");
var cfenv = require("cfenv");
var bodyParser = require("body-parser");
var axios = require("axios");
var HTMLParser = require("fast-html-parser");
var jwt = require("jsonwebtoken");
var crypto = require("crypto");
var https = require("https");
var dotenv = require("dotenv").config();
var jsrender = require("jsrender");
const Mailjet = require("node-mailjet");
// Nodemailer should disappear
var environment = require("../package.json");
const json = require("body-parser/lib/types/json");
const fs = require("fs");

const defaultEndpoint = "s3.us.cloud-object-storage.appdomain.cloud";

console.info("\n ======== Config: ========= ");
console.info("\n ", CONFIG);

const length = 128;
const digest = "sha256";
const gmail = "";

const cloudantDBhostURL = process.env.dbProtocol + "://" + process.env.dbHost;
const cloudantDBAuth = {
  username: process.env.dbHostServiceUsername,
  password: process.env.dbHostServicePassword,
};

let getNodeJSServerURL = (request) => {
  return request.protocol + "://" + request.get("host");
};

let handleError = (caller, error, response) => {
  if (error.response) {
    // The request was made and the server responded with a status code that falls out of the range of 2xx
    //console.log("[NodeJS - /register /create cloudant db]Something went wrong - data : " + error.response.data);
    console.log(
      "[NodeJS - /" + caller + " api]Something went wrong - status : " + error.response.status
    );
    //console.log("[NodeJS - /register /create cloudant db]Something went wrong - status : " + error.response.headers);
    response.status(error.response.status).send(error.response.data);
  } else if (error.request) {
    // The request was made but no response was received `error.request` is an instance of XMLHttpRequest in the browser and an instance of
    // http.ClientRequest in node.js
    console.log("[NodeJS - /" + caller + " api]Something went wrong - request : " + error.request);
    response.status(500).send(error.request);
  } else {
    // Something happened in setting up the request that triggered an Error
    console.log("[NodeJS - /" + caller + " api]Something went wrong - message : " + error.message);
    response.status(500).send(error.message);
  }
};

// parse application/x-www-form-urlencoded
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);

// parse application/json
app.use(bodyParser.json());

//app.use(bodyParser.raw({ type: "multipart/form-data" }));

// Enable CORS
app.use(cors());

//Enable compression
app.use(compression());

app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "DELETE, PUT");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

/*Endpoint to get User details from username */
app.get("/api/user/:username", (request, response) => {
  console.log("/user called with parameter :", request.params.username);

  if (!request.params.username) {
    return response.status(400).send({
      code: "NoUsername",
      type: "technical",
      subtype: "missing request parameters",
      resource: "/api/upsertUserData",
      message: "No username",
    });
  }

  // fetch user from users table for update
  var selector = {
    selector: {
      $and: [
        {
          app: "mycellar",
        },
        {
          username: request.params.username,
        },
      ],
    },
  };

  axios({
    url: cloudantDBhostURL + "/app-users/_find",
    method: "post",
    auth: cloudantDBAuth,
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(JSON.stringify(selector)),
    },
    data: selector,
  })
    .then((res) => {
      if (res.data.docs.length != 0) {
        // username exists => return its data
        response.send({
          lastname: res.data.docs[0].lastname,
          firstname: res.data.docs[0].firstname,
          address: res.data.docs[0].address,
          email: res.data.docs[0].email,
          phone: res.data.docs[0].phone,
        });
      } else {
        // username doesn't exist => send back error
        return response.status(404).send({
          code: "LoginUsernameNotExist",
          type: "business",
          subtype: "user not found",
          resource: "/api/login",
          message: "username doesn't exist",
        });
      }
    })
    .catch((error) => handleError("user", error, response));
});

app.get("/api/ping", function (request, response, next) {
  console.log("[updateUserData]api ping called");
  resp = {
    status: "backend API server available",
    environment: {
      dbHost: process.env.dbHost,
      dbHostServiceUsername: process.env.dbHostServiceUsername,
      mailUserId: process.env.mailUserId,
    },
    backendVersion: environment.version,
  };
  response.json(resp);
});

// endpoint to the administrator to approval the request for a new signup to the application
// It will send registration confirmation on email address
app.get("/api/approveUserSignupRequest/:id", function (request, response, next) {
  console.log(
    "[approveUserSignupRequest]api called with parameter : ",
    JSON.stringify(request.params)
  );

  // fetch request from user-mngmt table correponding to received id
  var reqID = request.params.id;
  if (!reqID)
    return response.status(401).send({
      code: "NoRegistrationIDParameter",
      type: "business",
      subtype: "missing request parameter",
      resource: "/api/approveUserSignupRequest",
      message: "missing registrationID parameter",
    });

  axios({
    url: cloudantDBhostURL + "/user-mngt-app/" + reqID,
    method: "get",
    auth: cloudantDBAuth,
    headers: {
      "Content-Type": "application/json",
    },
  })
    .then((res) => {
      if (res.data) {
        if (res.data.type == "registration") {
          // if request is for new registration
          // send mail to user to confirm his registration

          var sendMailReq = {
            url: getNodeJSServerURL(request) + "/api/sendEMail",
            method: "POST",
            data: {
              to: res.data.email,
              subject: "Confirm your registration request",
              message: {
                title: "Email confirmation",
                text1: "Thank you for signin up to get a myCellar account !!",
                text2: "Before having you on board, please confirm you email address.",
                url:
                  getNodeJSServerURL(request) +
                  "/api/processUserRequestConfirmation/" +
                  res.data._id,
              },
              template: "confirmEmailTmpl.html",
            },
          };
          axios(sendMailReq)
            .then((sendMailReqResponse) => {
              return response.status(200).send({
                code: "OK",
                message: "User " + res.data.username + " request approval done",
                translateKey: "approveRegistrationRequestDONE",
              });
            })
            .catch((error) => handleError("approveUserSignupRequest", error, response));
        } else {
          return response.status(401).send({
            code: "NoRegistrationRequestFound",
            type: "business",
            subtype: "No data found",
            resource: "/api/approveUserSignupRequest",
            message: "No registration request found",
          });
        }
      }
    })
    .catch((error) => handleError("approveUserSignupRequest", error, response));
});

// endpoint to finalize the request for a new signup to the application
// It will
//    1. generate a new password
//    2. create an entry into the user table (with user data and newly generate password - state is registrationConfirmed)
//    3. create Wine Database corresponding to the chosen username
//    4. send mail to user with newly generated password
// request path contains the user request id :
// TODO change name into something more generic like : processRequestConfirmation
app.get("/api/processUserRequestConfirmation/:id", function (request, response, next) {
  console.log(
    "[processUserRequestConfirmation]api called with parameter : ",
    JSON.stringify(request.params)
  );

  const serverUrl = request.protocol + "://" + request.get("host");

  // Generate password
  var newPwd = Math.random().toString(36).slice(-8);

  // fetch request from user-mngmt table correponding to received id
  var reqID = request.params.id;
  if (!reqID)
    return response.status(401).send({
      code: "NoRegistrationIDParameter",
      type: "business",
      subtype: "missing request parameter",
      resource: "/api/processUserRequestConfirmation",
      message: "missing registrationID parameter",
    });

  axios({
    url: cloudantDBhostURL + "/user-mngt-app/" + reqID,
    method: "get",
    auth: cloudantDBAuth,
    headers: {
      "Content-Type": "application/json",
    },
  })
    .then((res) => {
      if (res.data) {
        if (res.data.type == "registration") {
          // if request is for new registration

          var upsertUserDataReq = {
            url: getNodeJSServerURL(request) + "/api/upsertUserData",
            method: "post",
            data: {
              username: res.data.username,
              action: "create",
              password: newPwd,
              lastname: res.data.lastname || "",
              firstname: res.data.firstname || "",
              address: res.data.address || "",
              email: res.data.email || "",
              phone: res.data.phone || "",
              state: "registrationConfirmed",
              app: "mycellar",
            },
          };

          axios(upsertUserDataReq)
            .then((upsertRes) => {
              // create user table
              var createUserTableReq = {
                url:
                  process.env.dbProtocol +
                  process.env.dbHostServiceUsername +
                  ":" +
                  process.env.dbHostServicePassword +
                  "@" +
                  process.env.dbHost +
                  "/cellar$" +
                  res.data.username,
                method: "put",
                auth: cloudantDBAuth,
              };
              // send mail
              var sendMailReq = {
                url: getNodeJSServerURL(request) + "/api/sendEMail",
                method: "POST",
                data: {
                  to: res.data.email,
                  subject: "Registration confirmed",
                  message: {
                    title: "Registration confirmed",
                    text1: "Your registration is now confirmed.",
                    text2: "You can start using the myCellar application.",
                    text3: "Please log on using the following credentials : ",
                    username: res.data.username,
                    pwd: newPwd,
                    url: getNodeJSServerURL(request),
                    text4:
                      "You will be asked to immediately change your password after the first login.",
                  },
                  template: "confirmRegistrationTmpl.html",
                },
              };

              axios
                .all([axios(createUserTableReq), axios(sendMailReq)])
                .then(
                  axios.spread((firstResponse, secondResponse) => {
                    console.log(
                      JSON.stringify(firstResponse.data),
                      JSON.stringify(secondResponse.data)
                    );
                    let htmlToReturn = jsrender.renderFile(
                      "./server/templates/confirmRegistrationTmpl.html",
                      sendMailReq.data.message
                    );
                    console.log("[processUserRequestConfirmation]api returns : " + htmlToReturn);
                    return response.status(200).send(htmlToReturn);
                  })
                )
                .catch((error) =>
                  handleError("processUserRequestConfirmation (combined)", error, response)
                );
            })
            .catch((error) =>
              handleError("processUserRequestConfirmation (combined)", error, response)
            );
        } else {
          // request is for password reset
          // Upsert user with newly generated password
          var upsertUserDataReq = {
            url: getNodeJSServerURL(request) + "/api/upsertUserData",
            method: "post",
            data: {
              username: res.data.username,
              action: "update",
              password: newPwd,
              state: "resetPasswordConfirmed",
            },
          };
          // send mail
          var sendMailReq = {
            url: getNodeJSServerURL(request) + "/api/sendEMail",
            method: "POST",
            data: {
              to: res.data.email,
              subject: "Password reset confirmed",
              message: {
                title: "Password reset confirmed",
                text1: "Your password has now been reset.",
                text2: "You can log back in the myCellar application again.",
                text3: "Please use now the following credentials : ",
                username: res.data.username,
                pwd: newPwd,
                url: getNodeJSServerURL(request),
                text4:
                  "You will be asked to immediately change your password after the next login.",
              },
              template: "confirmRegistrationTmpl.html",
            },
          };
          axios
            .all([axios(upsertUserDataReq), axios(sendMailReq)])
            .then(
              axios.spread((firstResponse, secondResponse) => {
                console.log(
                  JSON.stringify(firstResponse.data),
                  JSON.stringify(secondResponse.data)
                );
                return response
                  .status(200)
                  .send(
                    jsrender.renderFile(
                      "./server/templates/confirmRegistrationTmpl.html",
                      sendMailReq.data.message
                    )
                  );
              })
            )
            .catch((error) =>
              handleError("processUserRequestConfirmation (combined)", error, response)
            );
        }
      } else {
        return response.status(401).send({
          code: "NoRegistrationRequestFound",
          type: "business",
          subtype: "No data found",
          resource: "/api/processUserRequestConfirmation",
          message: "No registration request found",
        });
      }
    })
    .catch((error) => handleError("processUserRequestConfirmation", error, response));
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
/* DEPRECATED */
app.post("/api/createUserMngmtRequest", function (request, response, next) {
  if (
    !request.body.hasOwnProperty("type") ||
    (request.body.type != "registration" && request.body.type != "passwordReset")
  ) {
    return response.status(400).send({
      code: "NoOrInvalidType",
      type: "technical",
      subtype: "wrong request parameters",
      resource: "/api/createUserMngmtRequest",
      message: "No or invalid type",
    });
  }

  if (!request.body.hasOwnProperty("username")) {
    return response.status(400).send({
      code: "NoUsername",
      type: "technical",
      subtype: "missing request parameters",
      resource: "/api/createUserMngmtRequest",
      message: "No username",
    });
  }

  if (!request.body.hasOwnProperty("email")) {
    return response.status(400).send({
      code: "NoEMail",
      type: "technical",
      subtype: "missing request parameters",
      resource: "/api/createUserMngmtRequest",
      message: "No email",
    });
  }

  //store user credentials (user,password,salt and other required info) into the database
  var reqData = {
    app: "mycellar",
    type: request.body.type,
    userName: request.body.username,
    email: request.body.email,
    requestDate: new Date().toISOString(),
  };
  console.log("/createUserMngmtRequest user request data:", JSON.stringify(reqData));
  axios({
    url: cloudantDBhostURL + "/user-mngt-app",
    method: "post",
    auth: cloudantDBAuth,
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(JSON.stringify(reqData)),
    },
    data: reqData,
  })
    .then((res) =>
      response.send({
        requestID: res.data.id,
      })
    )
    .catch((error) => handleError("createUserMngmtRequest", error, response));
});

// Private endpoint to send a mail to the requestor.
// request body () :
// - to (mandatory)
// - from (optional)
// - subject (mandatory)
// - message (mandatory)
app.post("/api/sendEMail", function (request, response, next) {
  if (!request.body.hasOwnProperty("subject")) {
    return response.status(400).send({
      code: "NoSubject",
      type: "technical",
      subtype: "Missing request parameters",
      resource: "/api/sendEmail",
      message: "No Subject to send mail",
    });
  }
  if (!request.body.hasOwnProperty("message")) {
    return response.status(400).send({
      code: "NoMessage",
      type: "technical",
      subtype: "missing request parameters",
      resource: "/api/sendEmail",
      message: "No message",
    });
  }
  if (!request.body.hasOwnProperty("to")) {
    return response.status(400).send({
      code: "NoEMailAddress",
      type: "technical",
      subtype: "missing request parameters",
      resource: "/api/sendEmail",
      message: "No email address",
    });
  }

  console.log("APIKEY : " + process.env.MJ_APIKEY_PUBLIC);
  console.log("SECRETKEY : " + process.env.MJ_APIKEY_PRIVATE);
  const mailjet = Mailjet.apiConnect(process.env.MJ_APIKEY_PUBLIC, process.env.MJ_APIKEY_PRIVATE, {
    config: {},
    options: {},
  });

  let message = {};

  /*   if (!request.body.template) {
    message = {
      from: process.env.emailAdmin,
      to: request.body.to,
      subject: request.body.subject,
      text: request.body.message,
    };
  } else {
    let htmlMessage = jsrender.renderFile(
      "./server/templates/" + request.body.template,
      request.body.message
    );
    message = {
      from: process.env.emailAdmin,
      to: request.body.to,
      subject: request.body.subject,
      html: htmlMessage,
    };
  }
 */
  console.log("[sendEMail]mail message : " + JSON.stringify(request.body));

  const sendRequest = mailjet.post("send", { version: "v3.1" }).request({
    Messages: [
      {
        From: {
          Email: process.env.emailAdmin,
          Name: "MyCellar Admin",
        },
        To: [
          {
            Email: request.body.to,
            Name: "Requestor",
          },
        ],
        Subject: request.body.subject,
        TextPart: !request.body.template ? request.body.message : "",
        HTMLPart: !request.body.template
          ? ""
          : jsrender.renderFile(
              "./server/templates/" + request.body.template,
              request.body.message
            ),
      },
    ],
  });
  sendRequest
    .then((result) => {
      console.log(result.body);
      console.log("mail smtp send message call returned without error");
      response.send({
        result: "OK",
      });
    })
    .catch((err) => {
      console.log("mail smtp send message call error returned");
      console.log("status code :" + err.statusCode);
      response.status(500).send(err.statusCode);
    });
  /*   transporter.sendMail(message, function (err, res) {
    if (err != null) {
      console.log("mail smtp send message call error returned");
      response.status(500).send(err);
    } else {
      console.log("mail smtp send message call returned without error");
      response.send({
        result: "OK",
      });
    }
    console.log("send() callback returned: err:", err, "; res:", res);
  });
 */
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
  if (!request.body.hasOwnProperty("username")) {
    return response.status(400).send({
      code: "NoUsername",
      type: "technical",
      subtype: "missing request parameters",
      resource: "/api/upsertUserData",
      message: "No username",
    });
  }

  if (
    !request.body.hasOwnProperty("action") ||
    (request.body.action != "create" && request.body.action != "update")
  ) {
    return response.status(400).send({
      code: "NoUsername",
      type: "technical",
      subtype: "wrong request parameters",
      resource: "/api/upsertUserData",
      message: "No or invalid action",
    });
  }

  // if action is "create" then we should receive username, email, password & state
  if (
    !request.body.action == "create" &&
    !request.body.hasOwnProperty("password") &&
    !request.body.hasOwnProperty("username") &&
    !request.body.hasOwnProperty("email") &&
    !request.body.hasOwnProperty("state")
  ) {
    return response.status(400).send({
      code: "NoUsernameEMailPasswordInCreate",
      type: "technical",
      subtype: "wrong request parameters",
      resource: "/api/upsertUserData",
      message: "You need a username, email, password & state to create a user",
    });
  }

  // if action is "update" then we should at least receive a username
  if (!request.body.action == "update" && !request.body.hasOwnProperty("username")) {
    return response.status(400).send({
      code: "NoUsernameInUpdate",
      type: "technical",
      subtype: "wrong request parameters",
      resource: "/api/upsertUserData",
      message: "You need at least a username to update a user",
    });
  }

  // fetch user from users table for update
  var selector = {
    selector: {
      $and: [
        {
          app: "mycellar",
        },
        {
          username: request.body.username,
        },
      ],
    },
  };

  axios({
    url: cloudantDBhostURL + "/app-users/_find",
    method: "post",
    auth: cloudantDBAuth,
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(JSON.stringify(selector)),
    },
    data: selector,
  })
    .then((res) => {
      if (res.data.docs.length != 0) {
        // username exists => we can update it but not create it again ...
        if (request.body.action == "create") {
          return response.status(400).send({
            code: "UsernameAlReadyExistsInCreate",
            type: "technical",
            subtype: "data duplication",
            resource: "/api/upsertUserData",
            message: "Impossible to create because this username already exists",
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
            state: request.body.state || res.data.docs[0].state,
          };

          if (request.body.hasOwnProperty("password")) {
            // If a new password is given, it overwrites the existing one
            const salt = crypto.randomBytes(128).toString("base64");
            var hashedPw;
            try {
              hashedPw = crypto.pbkdf2Sync(request.body.password, salt, 10000, length, digest);
            } catch (err) {
              return response.status(500).json({
                error: err,
              });
            }
            //store user credentials (user,password,salt and other required info) into the database
            reqData.salt = salt;
            reqData.password = hashedPw.toString("hex");
          } else {
            // If no password is given, this is just an regular update and only the changes of the passed attributes are updated
            reqData.salt = res.data.docs[0].salt;
            reqData.password = res.data.docs[0].password;
          }

          console.log("/upsertUserData update reqData:", JSON.stringify(reqData));
          axios({
            url: cloudantDBhostURL + "/app-users/" + res.data.docs[0]._id,
            method: "PUT",
            auth: cloudantDBAuth,
            headers: {
              "Content-Type": "application/json",
              "Content-Length": Buffer.byteLength(JSON.stringify(reqData)),
            },
            data: reqData,
          }).then((updateRes) => {
            response.json(reqData);
          });
        }
      } else {
        // username doesn't exist => we will create it...
        if (request.body.action == "create") {
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
            state: request.body.state || "",
          };

          var newPwd = Math.random().toString(36).slice(-8);

          const salt = crypto.randomBytes(128).toString("base64");

          try {
            hashedPw = crypto.pbkdf2Sync(
              request.body.password ? request.body.password : newPwd,
              salt,
              10000,
              length,
              digest
            );
          } catch (err) {
            response.status(500).json({
              error: err,
            });
          }
          //store user credentials (user,password,salt and other required info) into the database
          reqData.salt = salt;
          reqData.password = hashedPw.toString("hex");

          console.log("/upsertUserData create reqData:", JSON.stringify(reqData));
          axios({
            url: cloudantDBhostURL + "/app-users",
            method: "POST",
            auth: cloudantDBAuth,
            headers: {
              "Content-Type": "application/json",
              "Content-Length": Buffer.byteLength(JSON.stringify(reqData)),
            },
            data: reqData,
          })
            .then((createRes) => {
              reqData._id = createRes.id;
              reqData._rev = createRes.rev;
              response.json(reqData);
            })
            .catch((error) => handleError("upsertUserData", error, response));
        } else {
          return response.status(401).send({
            code: "UsernameNotExistInUpdate",
            type: "technical",
            subtype: "missing data",
            resource: "/api/upsertUserData",
            message: "User to update doesn't exist",
          });
        }
      }
    })
    .catch((error) => handleError("upsertUserData", error, response));
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
  console.log("[processSignupRequest]api called with body : ", JSON.stringify(request.body));
  if (!request.body.hasOwnProperty("email") || !request.body.hasOwnProperty("username")) {
    return response.status(400).send({
      code: "NoEmailOrUsername",
      type: "business",
      subtype: "missing request parameters",
      resource: "/api/processSignupRequest",
      message: "No email or username",
    });
  }
  console.log(
    "request host : " + request.get("host") + " - request protocol : " + request.protocol
  );
  // Check that user doesn't already exists before creating a new one
  var selector = {
    selector: {
      $and: [
        {
          app: "mycellar",
        },
        {
          username: request.body.username,
        },
      ],
    },
  };

  axios({
    url: cloudantDBhostURL + "/app-users/_find",
    method: "post",
    auth: cloudantDBAuth,
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(JSON.stringify(selector)),
    },
    data: selector,
  })
    .then((res) => {
      if (res.data.docs.length != 0) {
        // username already exist
        return response.status(409).send({
          code: "UsernameAlreadyExists",
          type: "business",
          subtype: "data duplication",
          resource: "/api/processSignupRequest",
          message: "username " + request.body.username + " already exists",
        });
      } else {
        // prepare create entry into user request table
        var createUserReq = {
          url: cloudantDBhostURL + "/user-mngt-app/",
          method: "post",
          auth: cloudantDBAuth,
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(JSON.stringify(selector)),
          },
          data: {
            username: request.body.username,
            email: request.body.email,
            lastname: request.body.lastname || "",
            firstname: request.body.firstname || "",
            address: request.body.address || "",
            phone: request.body.phone || "",
            type: "registration",
            timestamp: new Date().toISOString(),
            app: "mycellar",
          },
        };
        axios(createUserReq)
          .then((createUserReqResponse) => {
            // prepare sending mail
            var sendMailReq = {
              url: getNodeJSServerURL(request) + "/api/sendEMail",
              method: "POST",
              data: {
                to: process.env.emailAdmin,
                subject: "Approval user signup request",
                message: {
                  title: "Approval user signup request",
                  text1: "Hi Philippe",
                  text2: "You received a new signup request. The user's data are : ",
                  name: request.body.lastName || "",
                  firstname: request.body.firstName || "",
                  username: request.body.username,
                  email: request.body.email,
                  phone: request.body.phone || "",
                  address: request.body.address || "",
                  url:
                    getNodeJSServerURL(request) +
                    "/api/approveUserSignupRequest/" +
                    createUserReqResponse.data.id,
                },
                template: "approveReqTmpl.html",
              },
            };
            axios(sendMailReq)
              .then((sendMailRes) => {
                return response.status(200).send({
                  code: "OK",
                  message: "User " + request.body.username + " registered",
                  translateKey: "registrationOK",
                  registrationID: createUserReqResponse.data.id,
                });
              })
              .catch((error) => handleError("processSignupRequest/sendMail", error, response));
          })
          .catch((error) => handleError("processSignupRequest/createUserRequest", error, response));
      }
    })
    .catch((error) => handleError("processSignupRequest/Find user", error, response));
});

// login method
// request body :
// - username
// - password
// returns either :
// - Error
// - {message, translateKey, user}
app.post("/api/login", function (request, response, next) {
  console.log("[login]api called with body : ", JSON.stringify(request.body));

  if (!request.body.hasOwnProperty("username")) {
    return response.status(400).send({
      code: "NoUsername",
      type: "business",
      subtype: "missing request parameters",
      resource: "/api/login",
      message: "No username",
    });
  }

  if (!request.body.hasOwnProperty("password")) {
    return response.status(400).send({
      code: "NoPassword",
      type: "business",
      subtype: "missing request parameters",
      resource: "/api/login",
      message: "No password",
    });
  }

  // get user credentials from the database
  var selector = {
    selector: {
      $and: [
        {
          app: "mycellar",
        },
        {
          username: request.body.username,
        },
      ],
    },
  };

  console.log("login using cloudant db : " + process.env.dbHost);
  axios({
    url: cloudantDBhostURL + "/app-users/_find",
    method: "post",
    auth: cloudantDBAuth,
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(JSON.stringify(selector)),
    },
    data: selector,
  })
    .then((result) => {
      if (result.data.docs.length == 0) {
        return response.status(404).send({
          code: "LoginUsernameNotExist",
          type: "business",
          subtype: "user not found",
          resource: "/api/login",
          message: "username doesn't exist",
        });
      } else {
        // username exist, check if his state is not 'resetPasswordPending'
        user = result.data.docs[0];
        if (user.state == "resetPasswordPending") {
          return response.status(400).send({
            code: "PendingResetPassword",
            type: "business",
            subtype: "reset password pending",
            resource: "/api/login",
            message:
              "A password reset has been requested for this user.  Please complete reset process first.",
          });
        } else {
          //compare password with stored hashed value
          user = result.data.docs[0];
          // verify that the password stored in the database corresponds to the given password
          var hash;
          try {
            hash = crypto.pbkdf2Sync(request.body.password, user.salt, 10000, length, digest);
          } catch (e) {
            return response.status(500).send({
              error: e,
            });
          }
          // check if password is correct by recalculating hash on password and comparing with stored value
          if (hash.toString("hex") === user.password) {
            console.log("password is correct");

            const token = jwt.sign(
              {
                user: user.username,
                dbserver: user.dbserver,
                dbUser: user.dbUser,
                dbPassword: user.dbPassword,
                permissions: [],
              },
              process.env.secret,
              {
                expiresIn: "30d",
              }
            );
            user.token = token;
            delete user.salt;
            if (user.state == "resetPasswordConfirmed" || user.state == "registrationConfirmed") {
              // After the user confirmed his request to register or to reset password from the mail he got in his mail box, we send back a special field "action" with value "changePassword" that will be checked in the client, to force the user to set a new password
              return response.status(200).send({
                code: "changePassword",
                action: "changePassword",
                type: "business",
                subtype: "Force to change password",
                resource: "/api/login",
                message: "You are forced to change your password",
                user: user,
              });
            } else {
              return response.status(200).send({
                code: "OK",
                type: "business",
                subtype: "Successfull login",
                resource: "/api/login",
                message: "You are logged in",
                user: user,
              });
            }
          } else {
            response.status(401).send({
              code: "BadPassword",
              type: "business",
              subtype: "wrong password",
              resource: "/api/login",
              message: "Wrong password",
            });
          }
        }
      }
    })
    .catch((error) => handleError("login", error, response));
});

// endpoint to receive request for a password reset request
// It will
//    1. create an entry into the registration table
//    2. Send registration confirmation on email address
//    3. Update user data status to 'resetPasswordPending'
// request body () :
// - username (mandatory)
app.post("/api/resetPassword", function (request, response, next) {
  console.log("[resetPassword]api called with body : ", JSON.stringify(request.body));

  const serverUrl = request.protocol + "://" + request.get("host");

  if (!request.body.hasOwnProperty("username")) {
    return response.status(400).send({
      code: "NoUsername",
      type: "business",
      subtype: "missing request parameters",
      resource: "/api/resetPassword",
      message: "No username",
    });
  }

  // Check that user exists before registering the request to reset his password
  var query = {
    selector: {
      $and: [
        {
          app: "mycellar",
        },
        {
          username: request.body.username,
        },
      ],
    },
  };

  axios({
    url: cloudantDBhostURL + "/app-users/_find",
    method: "post",
    auth: cloudantDBAuth,
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(JSON.stringify(query)),
    },
    data: query,
  })
    .then((res) => {
      if (res.data.docs.length != 0) {
        // a user with the given username exist for this application
        let user = res.data.docs[0];
        // prepare create user request
        var createUserReq = {
          url: cloudantDBhostURL + "/user-mngt-app/",
          method: "post",
          auth: cloudantDBAuth,
          headers: {
            "Content-Type": "application/json",
          },
          data: {
            username: request.body.username,
            email: user.email,
            type: "pwdReset",
            timestamp: new Date().toISOString(),
            app: "mycellar",
          },
        };
        /* creating user request in user-request db*/
        axios(createUserReq)
          .then((userRequest) => {
            // if user-request succesfully created, send mail and update user's state in users db
            // prepare sending mail to user
            var sendMailReq = {
              url: getNodeJSServerURL(request) + "api/sendEMail",
              method: "POST",
              data: {
                to: user.email,
                subject: "Confirm your password reset request",
                message: {
                  title: "Confirm Password Reset  confirmation",
                  text1: "We received your request to reset your password.",
                  text2:
                    "For security reasons, we want to check that you are the originator of this request.",
                  url:
                    getNodeJSServerURL(request) +
                    "/api/processUserRequestConfirmation/" +
                    userRequest.data.id,
                },
                template: "confirmEmailTmpl.html",
              },
            };
            // prepare user state update
            var updateUserDataReq = {
              url: getNodeJSServerURL(request) + "api/upsertUserData",
              method: "POST",
              data: {
                action: "update",
                username: user.username,
                state: "resetPasswordPending",
              },
            };

            axios
              .all([axios(sendMailReq), axios(updateUserDataReq)])
              .then(
                axios.spread((secondResponse, thirdResponse) => {
                  console.log(
                    JSON.stringify(secondResponse.data),
                    JSON.stringify(thirdResponse.data)
                  );
                  return response.status(200).send({
                    code: "OK",
                    message: "User " + request.body.username + "  password reset received",
                    translateKey: "pwdResetRequestOK",
                    registrationID: userRequest.data.id,
                  });
                })
              )
              .catch((error) => handleError("resetPassword (combined)", error, response));
          })
          .catch((error) => handleError("changePassword", error, response));
      } else {
        return response.status(404).send({
          code: "UsernameNotExist",
          type: "business",
          subtype: "user not found",
          resource: "/api/resetPassword",
          message: "username doesn't exist",
        });
      }
    })
    .catch((error) => handleError("resetPassword", error, response));
});

// changePassword method
// request body :
// - username
// - oldPassword
// - newPassword
// returns either :
// - Error
// - {message, translateKey}
app.post("/api/changePassword", function (request, response, next) {
  console.log("[changePassword]api called with body : ", JSON.stringify(request.body));

  const serverUrl = request.protocol + "://" + request.get("host");

  if (!request.body.hasOwnProperty("username")) {
    return response.status(400).send({
      code: "NoUsername",
      type: "technical",
      subtype: "missing request parameters",
      resource: "/api/changePassword",
      message: "No username",
    });
  }

  if (!request.body.hasOwnProperty("oldPassword")) {
    return response.status(400).send({
      code: "NoPreviousPassword",
      type: "technical",
      subtype: "missing request parameters",
      resource: "/api/changePassword",
      message: "No previous password",
    });
  }

  if (!request.body.hasOwnProperty("newPassword")) {
    return response.status(400).send({
      code: "NoNewPassword",
      type: "Technical",
      subtype: "missing request parameters",
      resource: "/api/changePassword",
      message: "No new password",
    });
  }

  // get user credentials from the database
  var selector = {
    selector: {
      $and: [
        {
          app: "mycellar",
        },
        {
          username: request.body.username,
        },
      ],
    },
  };

  axios({
    url: cloudantDBhostURL + "/app-users/_find",
    method: "post",
    auth: cloudantDBAuth,
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(JSON.stringify(selector)),
    },
    data: selector,
  })
    .then((result) => {
      if (result.data.docs.length == 0) {
        return response.status(404).send({
          code: "UsernameNotExist",
          type: "technical",
          subtype: "user not found",
          resource: "/api/changePassword",
          message: "username doesn't exist",
        });
      } else {
        // username exist, compare password with stored hashed value
        user = result.data.docs[0];
        // verify that the password stored in the database corresponds to the given password
        var hash;
        try {
          hash = crypto.pbkdf2Sync(request.body.oldPassword, user.salt, 10000, length, digest);
        } catch (e) {
          return response.status(500).send({
            error: e,
          });
        }
        // check if password is correct by recalculating hash on password and comparing with stored value
        if (hash.toString("hex") === user.password) {
          console.log("old password is correct");
          if (user.state == "resetPasswordPending") {
            return response.status(403).send({
              code: "PendingResetPassword",
              type: "business",
              subtype: "reset password pending",
              resource: "/api/changePassword",
              message:
                "A password reset has been requested for this user.  Please complete reset process first.",
            });
          } else {
            // Update user 's data state to "standard" and change password
            var upsertUserDataReq = {
              url: getNodeJSServerURL(request) + "/api/upsertUserData",
              method: "post",
              data: {
                username: request.body.username,
                action: "update",
                password: request.body.newPassword,
                state: "standard",
              },
            };

            axios(upsertUserDataReq)
              .then((upsertRes) => {
                return response.status(200).send({
                  code: "OK",
                  message: "change password succesfull",
                  translateKey: "updateUserPasswordOK",
                  user: user,
                });
              })
              .catch((error) => handleError("changePassword", error, response));
          }
        } else {
          response.status(401).send({
            code: "BadPassword",
            type: "business",
            subtype: "wrong password",
            resource: "/api/changePassword",
            message: "Wrong password",
          });
        }
      }
    })
    .catch((error) => handleError("changePassword", error, response));
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
app.post("/api/updateUserData", function (request, response, next) {
  console.log("[updateUserData]api called with body : ", JSON.stringify(request.body));

  const serverUrl = request.protocol + "://" + request.get("host");

  if (!request.body.hasOwnProperty("username")) {
    return response.status(400).send({
      code: "NoUsername",
      type: "technical",
      subtype: "missing request parameters",
      resource: "/api/updateUserData",
      message: "No username",
    });
  }

  var upsertUserDataReq = {
    url: getNodeJSServerURL(request) + "/api/upsertUserData",
    method: "post",
    data: {
      username: request.body.username,
      action: "update",
      lastname: request.body.lastname || "",
      firstname: request.body.firstname || "",
      address: request.body.address || "",
      email: request.body.email || "",
      phone: request.body.phone || "",
      state: "standard",
    },
  };

  axios(upsertUserDataReq)
    .then((upsertRes) => {
      return response.status(200).send({
        code: "OK",
        message: "update user data successfull",
        translateKey: "updateUserDataOK",
        user: upsertRes.data,
      });
    })
    .catch((error) => handleError("updateUserData", error, response));
});

// savePhoto method
// request body :
// - user : username (used to create a folder inside the COS bucket)
// - name : file name in COS
// - image :Binary content (Blob)
// returns either :
// - Error
// - {message "save photo successfull", translateKey}
app.post("/api/photo", upload.single("image"), async (request, response, next) => {
  console.log("[savePhoto]api called");

  if (!request.body.user) {
    return response.status(400).send({
      code: "NoName",
      type: "technical",
      subtype: "missing request parameters",
      resource: "/api/savePhoto",
      message: "No username",
    });
  }

  if (!request.body.name) {
    return response.status(400).send({
      code: "NoName",
      type: "technical",
      subtype: "missing request parameters",
      resource: "/api/savePhoto",
      message: "No name",
    });
  }

  if (!request.file) {
    return response.status(400).send({
      code: "NoBlob",
      type: "technical",
      subtype: "missing request parameters",
      resource: "/api/savePhoto",
      message: "No image",
    });
  }

  let image = request.file;
  let name = request.body.user + "/" + request.body.name;

  try {
    /* Extract the serviceCredential and bucketName from the config.js file
     * The service credential can be created in the COS UI's Service Credential Pane
     */
    const { serviceCredential } = CONFIG;
    const { bucketName } = CONFIG;

    /* Create the S3 Client using the IBM-COS-SDK - https://www.npmjs.com/package/ibm-cos-sdk
     * We will use a default endpoint to initially find the bucket endpoint
     *
     * COS Operations can be done using an IAM APIKey or HMAC Credentials.
     * We will create the S3 client differently based on what we use.
     */
    let s3;
    if (!CONFIG.useHmac) {
      s3 = await getS3(defaultEndpoint, serviceCredential);
    } else {
      s3 = await getS3Hmac(defaultEndpoint, serviceCredential);
    }
    console.log("got s3 client");

    /* Fetch the Extended bucket Info for the selected bucket.
     * This call will give us the bucket's Location
     */
    const data = await listBuckets(s3, bucketName);
    const bucket = data.Buckets[0];
    console.log("got bucket");

    /* Fetch all the available endpoints in Cloud Object Storage
     * We need to find the correct endpoint to use based on our bucjket's location
     */
    const endpoints = await getEndpoints(serviceCredential.endpoints);
    console.log("got endpoints");

    /* Find the correct endpoint and set it to the S3 Client
     * We can skip these steps and directly assign the correct endpoint if we know it
     */
    s3.endpoint = findBucketEndpoint(bucket, endpoints);

    /* Upload Objects into the selected bucket
     */
    await putImage(s3, bucketName, name, image);
    //await putObjects(s3, bucketName, request.body.name, request.body.blob);

    console.info("\nphoto saved succesfully in IBM COS");
    return response.status(200).send({
      code: "OK",
      message: "save photo successfull",
      translateKey: "savePhotoOK",
    });
  } catch (err) {
    console.error("Found an error in S3 putObjet operation");
    console.error("statusCode: ", err.statusCode);
    console.error("message: ", err.message);
    console.error("stack: ", err.stack);
    handleError("savePhoto", err, response);
  }
});

// getPhoto method
// request parameter :
// - user : username (used to create a folder inside the COS bucket)
// - id : wine id (= file name in COS)
// returns either :
// - Error
// - {message "get photo successfull", translateKey}
app.get("/api/photo/:user/:id", async (request, response, next) => {
  console.log("[getPhoto]api called for name : " + request.params.id);

  if (!request.params.user) {
    return response.status(400).send({
      code: "NoUsername",
      type: "technical",
      subtype: "missing request parameters",
      resource: "/api/deletePhoto",
      message: "No id",
    });
  }
  if (!request.params.id) {
    return response.status(400).send({
      code: "NoId",
      type: "technical",
      subtype: "missing request parameters",
      resource: "/api/getPhoto",
      message: "No id",
    });
  }

  try {
    /* Extract the serviceCredential and bucketName from the config.js file
     * The service credential can be created in the COS UI's Service Credential Pane
     */
    const { serviceCredential } = CONFIG;
    const { bucketName } = CONFIG;

    /* Create the S3 Client using the IBM-COS-SDK - https://www.npmjs.com/package/ibm-cos-sdk
     * We will use a default endpoint to initially find the bucket endpoint
     *
     * COS Operations can be done using an IAM APIKey or HMAC Credentials.
     * We will create the S3 client differently based on what we use.
     */
    let s3;
    if (!CONFIG.useHmac) {
      s3 = await getS3(defaultEndpoint, serviceCredential);
    } else {
      s3 = await getS3Hmac(defaultEndpoint, serviceCredential);
    }

    /* Fetch the Extended bucket Info for the selected bucket.
     * This call will give us the bucket's Location
     */
    const data = await listBuckets(s3, bucketName);
    const bucket = data.Buckets[0];

    /* Fetch all the available endpoints in Cloud Object Storage
     * We need to find the correct endpoint to use based on our bucjket's location
     */
    const endpoints = await getEndpoints(serviceCredential.endpoints);

    /* Find the correct endpoint and set it to the S3 Client
     * We can skip these steps and directly assign the correct endpoint if we know it
     */
    s3.endpoint = findBucketEndpoint(bucket, endpoints);

    /* Upload Objects into the selected bucket
     */
    let returnedData = await getObject(
      s3,
      bucketName,
      request.params.user + "/" + request.params.id
    );
    //await putObjects(s3, bucketName, request.body.name, request.body.blob);

    //console.info("\nphoto loaded succesfully from IBM COS");
    return response.status(200).send({
      data: returnedData,
      code: "OK",
      message: "get photo successfull",
      translateKey: "getPhotoOK",
    });
  } catch (err) {
    console.error("Found an error in S3 getObject operation");
    console.error("statusCode: ", err.statusCode);
    console.error("message: ", err.message);
    console.error("stack: ", err.stack);
    handleError("savePhoto", err, response);
  }
});

// deletePhoto method
// request parameter :
// - user : username (used to create a folder inside the COS bucket)
// - id : wine id (= file name in COS)
// returns either :
// - Error
// - {message "delete photo successfull", translateKey}
app.delete("/api/photo/:user/:id", async (request, response, next) => {
  console.log("[deletePhoto]api called for name : " + request.params.id);

  if (!request.params.user) {
    return response.status(400).send({
      code: "NoUsername",
      type: "technical",
      subtype: "missing request parameters",
      resource: "/api/deletePhoto",
      message: "No id",
    });
  }
  if (!request.params.id) {
    return response.status(400).send({
      code: "NoId",
      type: "technical",
      subtype: "missing request parameters",
      resource: "/api/deletePhoto",
      message: "No username",
    });
  }

  try {
    /* Extract the serviceCredential and bucketName from the config.js file
     * The service credential can be created in the COS UI's Service Credential Pane
     */
    const { serviceCredential } = CONFIG;
    const { bucketName } = CONFIG;

    /* Create the S3 Client using the IBM-COS-SDK - https://www.npmjs.com/package/ibm-cos-sdk
     * We will use a default endpoint to initially find the bucket endpoint
     *
     * COS Operations can be done using an IAM APIKey or HMAC Credentials.
     * We will create the S3 client differently based on what we use.
     */
    let s3;
    if (!CONFIG.useHmac) {
      s3 = await getS3(defaultEndpoint, serviceCredential);
    } else {
      s3 = await getS3Hmac(defaultEndpoint, serviceCredential);
    }
    //console.log("got s3 client");

    /* Fetch the Extended bucket Info for the selected bucket.
     * This call will give us the bucket's Location
     */
    const data = await listBuckets(s3, bucketName);
    const bucket = data.Buckets[0];
    //console.log("got bucket");

    /* Fetch all the available endpoints in Cloud Object Storage
     * We need to find the correct endpoint to use based on our bucjket's location
     */
    const endpoints = await getEndpoints(serviceCredential.endpoints);
    //console.log("got endpoints");

    /* Find the correct endpoint and set it to the S3 Client
     * We can skip these steps and directly assign the correct endpoint if we know it
     */
    s3.endpoint = findBucketEndpoint(bucket, endpoints);

    /* Upload Objects into the selected bucket
     */
    let returnedData = await deleteObject(
      s3,
      bucketName,
      request.params.user + "/" + request.params.id
    );
    //await putObjects(s3, bucketName, request.body.name, request.body.blob);

    //console.info("\nphoto loaded succesfully from IBM COS");
    return response.status(200).send({
      data: returnedData,
      code: "OK",
      message: "delete photo successfull",
      translateKey: "deletePhotoOK",
    });
  } catch (err) {
    console.error("Found an error in S3 operations");
    console.error("statusCode: ", err.statusCode);
    console.error("message: ", err.message);
    console.error("stack: ", err.stack);
    handleError("deletePhoto", err, response);
  }
});

//serve static file (index.html, images, css)
console.log("__dirname : " + __dirname);
console.log("pwd : " + process.cwd());
var staticFileRootPath = process.cwd() + "/client/www/browser";
console.log("staticFileRootPath : " + staticFileRootPath);
//app.use(express.static(__dirname + "./../client/www"));

app.use(express.static(staticFileRootPath));

app.get("*", function (request, response) {
  response.sendFile("index.html", {
    root: staticFileRootPath,
  });
});

var port = process.env.PORT || 8080;
app.listen(port, function () {
  console.log("To view your app, open this link in your browser on port : " + port);
});
