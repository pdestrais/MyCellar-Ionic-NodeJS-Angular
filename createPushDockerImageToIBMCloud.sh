ibmcloud cr login
ibmcloud target -g default -r us-south   
docker build -t pdestrais/mycellar .
docker tag pdestrais/mycellar us.icr.io/phd-registry/mycellar:latest
docker push us.icr.io/phd-registry/mycellar:latest
ibmcloud ce project select -n first     
# ibmcloud ce secret create --name mycellarsecret  --from-file .env
ibmcloud ce secret delete --name mycellarsecret  
ibmcloud ce secret create --name mycellarsecret --from-literal env1=value1
awk -F '[=]' '{print $1, $2}' .env.prod | while read A B; do
    ibmcloud ce secret update --name mycellarsecret --from-literal $A=$B
done
ibmcloud ce app delete -n my-cellar-app
ibmcloud ce app create -n my-cellar-app -i us.icr.io/phd-registry/mycellar:latest --env-sec mycellarsecret