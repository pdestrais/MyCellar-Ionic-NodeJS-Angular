apiKey=$(cat ./apiKey.txt)
ibmcloud login --apikey "$apiKey"
ibmcloud target -g default -r eu-de   
docker build -t pdestrais/mycellar .
ibmcloud cr region-set eu-central
ibmcloud cr login
docker tag pdestrais/mycellar de.icr.io/phd-registry/mycellar:latest
docker push de.icr.io/phd-registry/mycellar:latest
ibmcloud ce project select -n myprojects     
# ibmcloud ce secret create --name mycellarsecret  --from-file .env
ibmcloud ce secret delete --name mycellarsecret  
ibmcloud ce secret create --name mycellarsecret --from-literal env1=value1
awk -F '[=]' '{print $1, $2}' .env.prod | while read A B; do
    ibmcloud ce secret update --name mycellarsecret --from-literal $A=$B
done
ibmcloud ce app delete -n my-cellar-app
# Secret must be created beforehand using the following command
# ibmcloud ce secret create --format registry --name myregistry --server de.icr.io --username iamapikey --password <apiKey>
ibmcloud ce app create -n my-cellar-app -i de.icr.io/phd-registry/mycellar:latest --env-sec mycellarsecret --rs myregistry --memory 0.25G --cpu 0.125
