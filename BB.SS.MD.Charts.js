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
  
  const process = (context) => {
    let request = context.request;

    if (request.method == 'POST') {
      let data = JSON.parse(request.body);

      // available globally
      response = context.response; 

      if (data.action == 'getAptBooked') {
        getAptBooked();
      } else if (data.action == 'getBacklog') {
        getBacklog();
      } else if (data.action == 'getMonthlyResidential') {
        getMonthlyResidential();
      } else if (data.action == 'getOpenReceivables') {
        getOpenReceivables();
      } else if (data.action == 'getPanelsInstalled') {
        getPanelsInstalled();
      }
    }
  }

  const getPanelsInstalled = () => {
    let baseDataSet = [];
    let baseData = [];
    
    let search = nSearch.create({
      type: "job",
      filters:
      [
        ["custentity_bb_customer_category","anyof","1"], 
        "AND", 
        ["custentity_bb_install_scheduled_date","isnotempty",""]
      ],
      columns:
      [
        nSearch.createColumn({
          name: "custentity_bb_module_quantity_num",
          summary: "SUM",
          label: "Final Number of Solar Modules"
        }),
        nSearch.createColumn({
          name: "custentity_bb_install_scheduled_date",
          summary: "GROUP",
          function: "month",
          sort: nSearch.Sort.ASC,
          label: "Installation Scheduled"
        }),
        nSearch.createColumn({
          name: "custentity_bb_system_size_decimal",
          summary: "SUM",
          label: "System Size (kW)"
        }),
        nSearch.createColumn({
          name: "entityid",
          summary: "COUNT",
          label: "ID"
        })
      ]
    });

    let date = [];

    const finalNoSolarPanels = [0];
    const countOfDeals = [0];
    const systemSizeMw = [0];

    search.run().each((result) => {
      let qty = result.getValue({name:'custentity_bb_module_quantity_num', summary: "SUM"});
      let startdate = result.getValue({name:'custentity_bb_install_scheduled_date', summary: "GROUP"});
      let systemsize = result.getValue({name:'custentity_bb_system_size_decimal', summary: "SUM"});
      let entityid = result.getValue({name:'entityid', summary: "COUNT"});
      
      date = startdate;

      finalNoSolarPanels.push(parseInt(qty));
      countOfDeals.push(entityid);
      systemSizeMw.push(parseInt(systemsize));
  
      baseData.push(date);

      return true;
    });
    
    baseDataSet.push({name: 'Final No. of Solar Modules', data: finalNoSolarPanels});
    baseDataSet.push({name: 'Count of Deals', data: countOfDeals});
    baseDataSet.push({name: 'System Size (kW)', data: systemSizeMw});
    

    writeResponse({
      categories: baseData,
      baseDataSet: baseDataSet
    });
  }

  const getOpenReceivables = () => {
    let baseDataSet = [];
    let categories = [];
    
    let search = nSearch.create({
      type: "invoice",
      filters:
      [
        ["type","anyof","CustInvc"], 
        "AND", 
        ["status","anyof","CustInvc:A"], 
        "AND", 
        ["mainline","is","T"]
      ],
      columns:
      [
        nSearch.createColumn({
          name: "netamount",
          summary: "SUM",
          label: "Amount (Net)"
        }),
        nSearch.createColumn({
          name: "custbody_bb_milestone",
          summary: "GROUP",
          sort: nSearch.Sort.ASC,
          label: "Milestone"
        })
      ]
    });

    var obj = {};
    obj.data = [];

    search.run().each(function(result){
      let netamount = result.getValue({name:'netamount', summary: "SUM"});
      let custbody_bb_milestone = result.getText({name:'custbody_bb_milestone', summary: "GROUP"});

      obj.data.push(parseInt(netamount));

      categories.push(custbody_bb_milestone);

      return true;
    });

    baseDataSet.push(obj);

    writeResponse({
      baseDataSet: baseDataSet,
      categories: categories
    });
  }

  const groupDataByYear = (data) => {
    const groupedData = {};
  
    for (const item of data) {
      const year = item.date.slice(0, 4);
      if (!groupedData[year]) {
        groupedData[year] = { name: year, data: [] };
      }
      groupedData[year].data.push(item.amount);
    }
  
    return Object.values(groupedData);
  }
  
  const getMonthlyResidential = () => {
    let today = new Date();
    let actualYear = today.getFullYear();
    let lastYear = today.getFullYear() - 1;
    let results = [];

    for (let i = 1; i <= 12; i++) {
      results.push({
        date: lastYear + '-' + String(i).padStart(2, '0'),
        amount: 0
      });
    }

    for (let i = 1; i <= 12; i++) {
      results.push({
        date: actualYear + '-' + String(i).padStart(2, '0'),
        amount: 0
      });
    }

    let search = nSearch.create({
      type: "job",
      filters:
      [
        ["custentity_bb_project_start_date","onorafter","1/1/" + lastYear]
      ],
      columns:
      [
        nSearch.createColumn({
          name: "custentity_bb_fin_prelim_purch_price_amt",
          summary: "SUM",
          label: "Preliminary Purchase Price"
        }),
        nSearch.createColumn({
          name: "custentity_bb_project_start_date",
          summary: "GROUP",
          function: "month",
          label: "Project Start Date",
          sort: nSearch.Sort.ASC
        })
      ]
    });

    search.run().each((result) => {
      let trandate = result.getValue({name: 'custentity_bb_project_start_date', summary: "GROUP"});
      let amount = result.getValue({name: 'custentity_bb_fin_prelim_purch_price_amt', summary: "SUM"});
      
      let year = trandate.slice(0,4);

      if (year == actualYear || year == lastYear) {
        let main = results.find(item => item.date == trandate);

        main.amount = parseInt(amount);
      }

      return true;
    });

    writeResponse({
      baseDataSet: groupDataByYear(results)
    })
  }

  const getBacklog = () => {
    let baseDataSet = [];
            
    let search = nSearch.create({
      type: "transaction",
      filters:
      [
        ["type","anyof","CustInvc","CustCred"], 
        "AND", 
        ["custbody_bb_project","noneof","@NONE@"], 
        "AND", 
        ["mainline","is","T"]
      ],
      columns:
      [
        nSearch.createColumn({
          name: "custentity_bb_system_size_decimal",
          join: "CUSTBODY_BB_PROJECT",
          summary: "SUM",
          sort: nSearch.Sort.ASC,
          label: "System Size (kW)"
        }),
        nSearch.createColumn({
          name: "internalid",
          summary: "COUNT",
          label: "Internal ID"
        })
      ]
    });

    search.run().each((result) => {
      let SytemSizeKw = result.getValue({name: 'custentity_bb_system_size_decimal', join: 'CUSTBODY_BB_PROJECT', summary: "SUM"});
      let TotalCount = result.getValue({name: 'internalid', summary: "COUNT"});

      baseDataSet.push(parseInt(SytemSizeKw), parseInt(TotalCount));

      return true;
    });

    writeResponse({
      baseDataSet: baseDataSet
    });
  }

  const getAptBooked = () => {
    let today = new Date();
    let actualYear = today.getFullYear();
    let lastYear = today.getFullYear() - 1;
    let results = [];

    for (let i = 1; i <= 12; i++) {
      results.push({
        date: lastYear + '-' + String(i).padStart(2, '0'),
        amount: '0'
      });
    }

    for (let i = 1; i <= 12; i++) {
      results.push({
        date: actualYear + '-' + String(i).padStart(2, '0'),
        amount: '0'
      });
    }

    let search = nSearch.create({
      type: 'phonecall',
      filters:
      [
        ['status', 'anyof', 'COMPLETE']
      ],
      columns:
      [
        nSearch.createColumn({
          name: 'completeddate',
          summary: 'GROUP',
          function: 'month',
          label: 'Date Completed',
          sort: nSearch.Sort.ASC
        }),
        nSearch.createColumn({
          name: 'internalid',
          summary: 'COUNT',
          label: 'Internal ID'
        })
    ]
    });
    
    search.run().each((result) => {
      let startdate = result.getValue({name:'completeddate', summary: "GROUP"});
      let internalid = result.getValue({name:'internalid', summary: "COUNT"});

      let year = startdate.slice(0,4);

      if (year == actualYear || year == lastYear) {
        let main = results.find(item => item.date == startdate);

        main.amount = internalid;
      }

      return true;
    });

    writeResponse({
      baseDataSet: groupDataByYear(results)
    });
  }

  const writeResponse = (data) => {
    response.write({output: JSON.stringify(data)});
  }

  return {
    process: process
  };
});
