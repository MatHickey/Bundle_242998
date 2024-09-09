/**
 * @NApiVersion 2.1
 * @NModuleScope Public
 */
define([
  'N/search', 
  'N/redirect'
], (
  nSearch, 
  nRedirect
) => {
  let response;

  const process = (context) => {
    let request = context.request;

    //getConfiguration();

    if (request.method == 'POST') {
      let data = JSON.parse(request.body);
      // available globally
      response = context.response; 

      if (data.action == 'getForecast') {
        //getForecast();
      } 
    } else if (request.method == 'GET') {
      // let parameters = request.parameters;

      // if (parameters.goToProject) {
      //   let projectId = parameters.goToProject;

      //   nRedirect.toRecord({
      //     id: projectId,
      //     type: 'job'
      //   });
      // } else if (parameters.goToTransaction) {
      //   nRedirect.toRecord({
      //     id: parameters.goToTransaction,
      //     type: parameters.type
      //   });
      // } else if (parameters.goToExpense) {
      //   nRedirect.toRecord({
      //     id: parameters.goToExpense,
      //     type: 'customrecord_bb_ss_scheduled_forecast'
      //   });
      // }
    }
  }

  const writeResponse = (data) => {
    response.write({output: JSON.stringify(data)});
  }

  return {
    process: process
  };
});
