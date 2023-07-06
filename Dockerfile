#############
### build ###
#############

# base image
FROM node:lts-hydrogen as buildimg

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
RUN npm install -g @angular/cli@13.0.1


# run tests
# RUN ng test --watch=false
# RUN ng e2e --port 4202

# generate build
RUN ng build --prod=true

############
### prod ###
############

# base image
FROM node:hydrogen-alpine3.17

# set working directory
WORKDIR /app

# copy artifact build from the 'build environment'
COPY --from=buildimg /app/www /app/client/www
COPY package.json /app/package.json
COPY ./server /app/server
#not needed for deployment on code engine as env variable are defined in code engine
#COPY .env.prod /app/.env
RUN npm install
EXPOSE 8080
CMD [ "node", "server/server.js" ]
