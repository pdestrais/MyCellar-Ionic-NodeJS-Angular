#############
### build ###
#############

# base image
FROM node:12.2.0 as build

# install chrome for protractor tests
# RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add -
# RUN sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list'
# RUN apt-get update && apt-get install -yq google-chrome-stable

# set working directory
WORKDIR /app

# add `/app/node_modules/.bin` to $PATH
ENV PATH /app/node_modules/.bin:$PATH

# install and cache app dependencies
COPY ./client/*.* /app/
# add app/
COPY ./client/src /app/src
COPY ./server /app/server

RUN npm install
RUN npm install -g @angular/cli@8.3.25


# run tests
# RUN ng test --watch=false
# RUN ng e2e --port 4202

# generate build
RUN ng build --prod=true

############
### prod ###
############

# base image
FROM node:12-alpine

# set working directory
WORKDIR /app

# copy artifact build from the 'build environment'
COPY --from=build /app/www /app/client/www
COPY package.json /app/package.json
COPY ./server /app/server
RUN npm install
EXPOSE 5001
CMD [ "node", "server/server.js" ]
