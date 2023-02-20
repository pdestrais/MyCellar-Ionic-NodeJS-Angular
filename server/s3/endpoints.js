const axios = require("axios");

/*
 * Cloud Object Storage is available in 3 resiliency across many Availability Zones across the world.
 * Each AZ will require a different endpoint to access the data in it.
 * The endpoints url provides a JSON consisting of all Endpoints for the user.
 */
const getEndpoints = async (endpointsUrl) => {
  console.info("======= Getting Endpoints =========");

  const options = {
    url: endpointsUrl,
    method: "GET",
  };
  const response = await axios(options);
  return response.data;
};

/*
 * Once we have the available endpoints, we need to extract the endpoint we need to use.
 * This method uses the bucket's LocationConstraint to determine which endpoint to use.
 */
const findBucketEndpoint = (bucket, endpoints) => {
  const region =
    bucket.region ||
    bucket.LocationConstraint.substring(
      0,
      bucket.LocationConstraint.lastIndexOf("-")
    );
  const serviceEndpoints = endpoints["service-endpoints"];
  const regionUrls =
    serviceEndpoints["cross-region"][region] ||
    serviceEndpoints.regional[region] ||
    serviceEndpoints["single-site"][region];

  if (!regionUrls.public || Object.keys(regionUrls.public).length === 0) {
    return "";
  }
  return Object.values(regionUrls.public)[0];
};

module.exports = { findBucketEndpoint, getEndpoints };
