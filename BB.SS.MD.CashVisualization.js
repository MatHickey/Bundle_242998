/**
 * @NApiVersion 2.1
 * @NModuleScope Public
 */
define([
  'N/search', 
  'N/runtime', 
  'N/util', 
  'N/https',
  'N/record',
  'N/cache'
], (
  nSearch, 
  nRuntime, 
  nUtil, 
  nHttps,
  nRecord,
  nCache
) => {
  let response;

  const searches = {
    ap: [
      'customsearch_bb_ap_aging_1to30',
      'customsearch_bb_ap_aging_31to60',
      'customsearch_bb_ap_aging_61to90',
      'customsearch_bb_ap_aging_91toinfinity'
    ],
    ar: [
      'customsearch_bb_ar_aging_1to30',
      'customsearch_bb_ar_aging_31to60',
      'customsearch_bb_ar_aging_61to90',
      'customsearch_bb_ar_aging_91toinfinity'
    ]
  }
  
  const process = (context) => {
    let request = context.request;

    if (request.method == 'POST') {
      let data = JSON.parse(request.body);

      // available globally
      response = context.response; 

      if (data.action == 'getInflow') {
        getInflow();
      } else if (data.action == 'getOutflow') {
        getOutflow();
      } else if (data.action == 'getApAgingSummary') {
        getSummary('ap');
      } else if (data.action == 'getArAgingSummary') {
        getSummary('ar');
      }
    } 
  }

  const getSummary = (type) => {
    let dataSet = [];
    dataSet.push(getResultFromSearch(searches[type][0]));
    dataSet.push(getResultFromSearch(searches[type][1]));
    dataSet.push(getResultFromSearch(searches[type][2]));
    dataSet.push(getResultFromSearch(searches[type][3]));

    let maxStr = Math.max(...dataSet).toString();
    let maxDigits = maxStr.length;
    let divisor;
    let suffix;

    if (maxDigits >= 4) {    // 1,000 above, use thousands
      divisor = 1000;
      suffix = 'k';
    }
    if (maxDigits >= 7) {    // 1,000,000 above, use millions
      divisor = 1000000;
      suffix = 'M';
    }

    writeResponse({
      dataSet: dataSet,
      itemDivisor: divisor,
      itemSuffix: suffix
    });
  }

  const getResultFromSearch = (searchId) => {
    let returnValue = 0;

    let search = nSearch.load({
      id: searchId
    });

    search.run().each((result) => {
      let total = result.getValue({name:'amountremaining', summary:'SUM'});
      
      returnValue = parseInt(total) || 0;
    });

    return returnValue;
  }

  const getInflow = () => {
    let results = [];
    let search = nSearch.load({
      id: 'customsearch_bb_ss_cashvisualization_ar'
    });

    search.run().each((result) => {
      var obj = {};

      obj.number = result.getValue({name:'number'});
      resName = result.getValue({name:'name'});
      obj.name = resName.substring(resName.lastIndexOf(" : ")+3)
      obj.type = result.getValue({name:'type'});
      obj.balance = result.getValue({name:'balance'});
      
      results.push(obj);
  
      return true;
    });

    writeResponse(results);
  }

  const getOutflow = () => {
    let results = [];
    let search = nSearch.load({
      id: 'customsearch_bb_ss_cashvisualization_ap'
    });

    search.run().each((result) => {
      let obj = {};

      obj.number = result.getValue({name:'number'});
      resName = result.getValue({name:'name'});
      obj.name = resName.lastIndexOf(" : ") >= 0 ? resName.substring(resName.lastIndexOf(" : ")+3) : resName;
      obj.type = result.getValue({name:'type'});
      obj.balance = result.getValue({name:'balance'})*-1;
      
      results.push(obj);
  
      return true;
    });

    writeResponse(results);
  }

  const writeResponse = (data) => {
    response.write({output: JSON.stringify(data)});
  }

  return {
    process: process
  };
});
