/**
 * @NApiVersion 2.1
 * @NModuleScope Public
 * 
 * BB.SS.MD.Projectprofitabilityestimated.js
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
 
       if (data.action == 'PMProjectProfitabilityEstimated') {
         PMProjectProfitabilityEstimated();
       }
     }
   }
 
   const PMProjectProfitabilityEstimated = () => {
     let categories = [];
     var jobSearchObj = search.create({
       type: "job",
       filters:
       [
         ["custentity_bb_cancellation_date","isempty",""], 
         "AND", 
         ["custentity_bb_m3_date","isempty",""], 
         "AND", 
         ["custentity_bb_is_project_template","is","F"],
         "AND", 
         ["isinactive","is","F"]
       ],
       columns:
       [
          search.createColumn({
             name: "entityid",
             sort: search.Sort.ASC,
             label: "ID"
          }),
          search.createColumn({name: "custentity_bb_home_owner_name_text", label: "Customer"}),
          search.createColumn({name: "jobtype", label: "Project Type"}),
          search.createColumn({name: "custentity_bb_epc_role", label: "EPC Role"}),
          search.createColumn({name: "custentity_bb_system_size_decimal", label: "System Size (kW)"}),
          search.createColumn({name: "custentity_bb_tot_contract_value_cpy_amt", label: "Total Contract Value"}),
          //search.createColumn({name: "custentity_bb_services_costs_pr_watt_amt", label: "Services Costs / Watt"}),
          search.createColumn({
           name: "formulacurrency",
           formula: "CASE WHEN {custentity_bb_services_costs_amount} IS NULL OR {custentity_bb_system_size_decimal} IS NULL OR {custentity_bb_system_size_decimal} = 0 THEN 0 ELSE ROUND({custentity_bb_services_costs_amount}/({custentity_bb_system_size_decimal}*1000), 2) END",
           label: "Services Costs / Watt"
        }),
          search.createColumn({name: "custentity_bb_equip_cost_per_watt_amount", label: "Equipment Cost / Watt"}),
          search.createColumn({
             name: "formulacurrency",
             formula: "{custentity_bb_gross_trading_profit_amt}/({custentity_bb_system_size_decimal}*1000)",
             label: "Gross After Sales Profit / Watt"
          }),
          search.createColumn({name: "custentity_bb_revenue_amount", label: "Revenue"}),
          search.createColumn({name: "custentity_bb_sales_cost_amount", label: "Sales Cost"}),
          search.createColumn({name: "custentity_bb_services_costs_amount", label: "Services Costs"}),
          search.createColumn({name: "custentity_bb_equip_cost_amount", label: "Equipment Cost"}),
          search.createColumn({
             name: "formulacurrency",
             formula: "NVL({custentity_bb_revenue_amount},0) - NVL({custentity_bb_sales_cost_amount},0) - NVL({custentity_bb_services_costs_amount},0) - NVL({custentity_bb_equip_cost_amount},0)",
             label: "Project Net Profit"
          }),
          //search.createColumn({name: "formulacurrency", formula: "(NVL({custentity_bb_revenue_amount},0) - NVL({custentity_bb_sales_cost_amount},0) - NVL({custentity_bb_services_costs_amount},0) - NVL({custentity_bb_equip_cost_amount},0))/({custentity_bb_system_size_decimal}*1000)", label: "Project Net Profit / Watt"}),
          search.createColumn({name: "formulacurrency", formula: "CASE WHEN {custentity_bb_system_size_decimal} IS NULL OR {custentity_bb_system_size_decimal} = 0 THEN 0 ELSE (COALESCE({custentity_bb_revenue_amount}, 0) - COALESCE({custentity_bb_sales_cost_amount}, 0) - COALESCE({custentity_bb_services_costs_amount}, 0) - COALESCE({custentity_bb_equip_cost_amount}, 0))/({custentity_bb_system_size_decimal}*1000) END", label: "Project Net Profit / Watt"}),
          search.createColumn({
             name: "formulacurrency",
             formula: "NVL({custentity_bb_revenue_amount},0) - NVL({custentity_bb_sales_cost_amount},0)",
             label: "Gross After Sales Profit"
          }),
          search.createColumn({name: "custentity_bb_project_location", label: "Project Location"}),
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
 