# Notepad ionic 4 - NodeJS - Electron application
This Cellar application is written in javascript using angular7/ionic4.
It uses a pouchDB to store notes to the local storage and can synchronize with a cloud Cloudant database to share notes between devices.

This application can be run either on a mobile (using PWA), in a browser or as a desktop application (using electron).

## installation
As always, type  `npm install`

## usage

### in development
the following command is used to start the dev server (from the project root/client)

      npm start

To test the application under electron, build the code using 

     npm run buildElectron

A 'www' directory will be created. This directory will be used for NodeJS as well as for electron.

To test with electron, launch electron from the project's 'client' directory :

     electron .

To test with NodeJS, go to root directory and start nodeJS with 

     npm start

### build prepare for the different deployment targets

- First, build the application for the 'client' directory. For the web, PWA or mobile targets :

          ionic build --prod or npm run buildProd

     For the Electron target :

        npm run buildElectron

- Second, push or create the deployment package
     - For Electron : prepare to build the electron desktop application using electron builder

               npm run dist

          A 'dist' directory will be created under the root of the project.
          A 'dmg' file has been created, double click on the file to install on the OS.<br>
          Sometimes, the command doesn't work. This seems to be relative to file permission issues, in that case, try to execute the same command with 'sudo'.

          If this still doesn't work, try to use yarn

               yarn add electron-builder --dev

          Then you can run `yarn dist`.

     - For the web app and PWA
     
          prepare to release publish as a nodeJS app on the IBM cloud (you need to have a user id on IBM cloud).
          Go to the root directory, then login to could foundry (if not yet done) and push the nodeJS as a cloudfoundry application :

               cf login
               cf push