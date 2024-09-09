/**
 * @NApiVersion 2.1
 * @NModuleScope Public
 * 
 * BB.SS.ProjectProfitability.Endpoint.js
 */
define([
    'N/search', 
    'N/runtime', 
    'N/util', 
    'N/https',
    'N/record',
    'N/cache'
  ], (
    search, 
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
        // available globallys
        response = context.response; 
  
        if (data.action == 'PMProjectProfitability') {
          PMProjectProfitability();
        }
      }
    }
  
    const PMProjectProfitability = () => {
      let categories = [];
      var jobSearchObj = search.create({
     type: "job",
     filters:
     [
        ["isinactive","is","F"], 
        "AND", 
        ["custentity_bb_is_project_template","is","F"], 
        "AND", 
        ["entityid","haskeywords","PROJ-1"], 
        "AND", 
        ["custentity_bb_gross_profit_percent","greaterthan","1"]
     ],
     columns:
     [
        search.createColumn({
           name: "entityid",
           sort: search.Sort.ASC,
           label: "ID"
        }),
        search.createColumn({name: "entitynumber", label: "Number"}),
        search.createColumn({name: "custentity_bb_home_owner_name_text", label: "Customer"}),
        search.createColumn({
           name: "formulatext",
           formula: "CASE WHEN {custentity_bb_m3_date} IS NOT NULL THEN 'M3' WHEN {custentity_bb_m2_date} IS NOT NULL THEN 'M2'  WHEN {custentity_bb_m1_date} IS NOT NULL THEN 'M1' WHEN {custentity_bb_m0_date} IS NOT NULL THEN 'M0' ELSE 'New' END",
           label: "Most Recent Milestone Complete"
        }),
        search.createColumn({name: "custentity_bb_total_contract_value_amt", label: "Total Contract Value"}),
        search.createColumn({name: "custentity_bb_total_project_ar_amount", label: "Total Project AR"}),
        search.createColumn({name: "custentity_bb_revenue_amount", label: "Revenue"}),
        search.createColumn({name: "custentity_bb_equip_cost_amount", label: "Equipment Cost"}),
        search.createColumn({name: "custentity_bb_services_costs_amount", label: "Services Costs"}),
        search.createColumn({
           name: "formulacurrency",
           formula: "NVL({custentity_bb_gross_profit_amount},NVL({custentity_bb_revenue_amount},0)-NVL({custentity_bb_equip_cost_amount},0) - NVL({custentity_bb_services_costs_amount},0))",
           label: "Gross Profit"
        }),
        search.createColumn({
           name: "formulapercent",
           formula: "NVL2({custentity_bb_revenue_amount},(NVL({custentity_bb_gross_profit_amount},NVL({custentity_bb_revenue_amount},0)-NVL({custentity_bb_equip_cost_amount},0) - NVL({custentity_bb_services_costs_amount},0)))/NULLIF({custentity_bb_revenue_amount},0),0)",
           label: "Gross Profit %"
        }),
        search.createColumn({name: "custentity_bb_project_location", label: "Project Location"}),
        search.createColumn({name: "custentity_bbss_proj_class", label: "Project Class"}),
        search.createColumn({name: "custentity_bbss_proj_department", label: "Project Department"})
     ]
  });
  var searchResultCount = jobSearchObj.runPaged().count;
     jobSearchObj.run().each(function(result){
        categories.push(result);
        return true;
     });
     
     writeResponse({
      categories: categories
    });
    }
  
    const writeResponse = (data) => {
      response.write({output: JSON.stringify(data)});
    }
  
    return {
        process: process
    };
  });
  