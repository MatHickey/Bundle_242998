/**
 * @NApiVersion 2.1
 * @NModuleScope Public
 * @NScriptType ScheduledScript
 */
define([
  'N/search', 
  'N/record'
], (
  nSearch, 
  nRecord
) => {

  const getAllResults = (s) => {
    let results = s.run();
    let searchResults = [];
    let searchid = 0;
    let resultsSlice = [];
    do {
      resultsSlice = results.getRange({start:searchid,end:searchid+1000});
      resultsSlice.forEach((slice) => {
        searchResults.push(slice);
        searchid++;
      });
    } while (resultsSlice.length >= 1000);

    return searchResults;
  }   
  
  function execute() {
    let results = [];
    let indexes = [
      {
        milestone: 'm0',
        fields: ['new_to_m0']
      },
      {
        milestone: 'm1',
        fields: ['new_to_m1', 'm0_to_m1']
      },
      {
        milestone: 'm2',
        fields: ['new_to_m2', 'm0_to_m2', 'm1_to_m2']
      },
      {
        milestone: 'm3',
        fields: ['new_to_m3', 'm0_to_m3', 'm1_to_m3', 'm2_to_m3']
      },
      {
        milestone: 'm4',
        fields: ['new_to_m4', 'm3_to_m4']
      }
    ];
    let columns = [
      nSearch.createColumn({name: 'internalid', sort: nSearch.Sort.ASC}),
      nSearch.createColumn({name: "custentity_bb_project_start_date", label: "Project Start Date"}),
      nSearch.createColumn({
        name: "custrecord_bbss_adv_subpay_amount",
        join: "CUSTRECORD_BBSS_ADV_SUBPAY_PROJECT",
      }),
      nSearch.createColumn({
        name: "custrecord_bbss_adv_subpay_amount_pct",
        join: "CUSTRECORD_BBSS_ADV_SUBPAY_PROJECT",
      }),
      nSearch.createColumn({
        name: "custrecord_bbss_adv_subpay_milestone",
        join: "CUSTRECORD_BBSS_ADV_SUBPAY_PROJECT",
        sort: nSearch.Sort.ASC
      }),
      nSearch.createColumn({
        name: "custrecord_bbss_adv_subpay_milestonedate",
        join: "CUSTRECORD_BBSS_ADV_SUBPAY_PROJECT"
      }),
      nSearch.createColumn({name: "custentity_bb_install_state", label: "Installation State"}),
      nSearch.createColumn({name: "custentity_bb_financier_customer", label: "Financier"}),
      nSearch.createColumn({name: "custentity_bb_financing_type", label: "Financing Type"}),
      nSearch.createColumn({name: "jobtype", label: "Project Type"}),
      nSearch.createColumn({name: "custentity_bb_financier_adv_pmt_schedule", label: "Financier Adv Pmt Schedule"}),
      nSearch.createColumn({name: "custentity_bb_system_size_decimal", label: "System Size (kW)"}),
      nSearch.createColumn({name: "custentity_bb_total_contract_value_amt", label: "Total Contract Value"}),
      nSearch.createColumn({
        name: "formulanumeric",
        formula: "(nvl( {custentity_bb_site_audit_amount}, 0) + nvl( {custentity_bb_design_amount}, 0) + nvl( {custentity_bb_installer_total_pay_amt}, 0) + nvl({custentity_bb_inspection_amount},0) +  nvl( {custentity_bb_warranty_service_amount}, 0)) / ( nullif( {custentity_bb_system_size_decimal}* 1000, 0) )",
        label: "service_cost_p_w"
      }),
      nSearch.createColumn({
        name: "formulanumeric",
        formula: "(nvl( {custentity_bb_inventory_amount}, 0) + nvl( {custentity_bb_shipping_amount}, 0) + nvl( {custentity_bb_sales_tax_amount}, 0) + nvl( {custentity_bb_rma_amount}, 0) + nvl(  {custentity_bb_warranty_inventory_amount}, 0)) / ( nullif( {custentity_bb_system_size_decimal}* 1000, 0) )",
        label: "equip_cost_p_w"
      }),
      nSearch.createColumn({
        name: "formulanumeric",
        formula: "{custentity_bb_project_so.totalamount} / ( nullif( {custentity_bb_system_size_decimal}* 1000, 0) )",
        label: "sales_cost_p_w"
      }),
      nSearch.createColumn({
        name: "formulanumeric",
        formula: "({custentity_bb_fin_total_invoice_amount} - {custentity_bb_project_so.totalamount} ) / ( nullif( {custentity_bb_system_size_decimal}* 1000, 0) )",
        label: "margin_p_w"
      })
    ];

    let search = nSearch.create({
      type: "job",
      filters: [
        // ["internalid","anyof","1053043","1053041","1053039","1052966"], 
        // "AND", 
        ['custentity_bb_financier_customer.isinactive', 'is', 'F'],
        'AND',
        ['isinactive', 'is', 'F'],
        'and',
        ["custrecord_bbss_adv_subpay_project.custrecord_bbss_adv_subpay_trans_type","anyof","7"], 
        'and',
        ['custentity_bb_financier_adv_pmt_schedule', 'noneof', '@NONE@'],
        "AND", 
        [[["custentity_bb_install_comp_pack_date","isempty",""],"OR",["custentity_bb_install_comp_pack_date","after","daysago90"]],"AND",[["custentity_bb_install_scheduled_date","isempty",""],"OR",["custentity_bb_install_scheduled_date","after","daysago90"]]]
      ],
      columns: columns
    });

    //search.save();

    getAllResults(search).map((result) => {
      results.push({
        id: result.getValue(columns[0]),
        start_date: result.getValue(columns[1]),
        milestone: result.getText(columns[4]),
        milestone_date: result.getValue(columns[5]),
        install_state: result.getValue(columns[6]),
        financier_customer: result.getValue(columns[7]),
        financing_type: result.getValue(columns[8]),
        job_type: result.getValue(columns[9]),
        adv_payment: result.getValue(columns[10]),
        system_size: parseFloat(result.getValue(columns[11])),
        contract_value: parseFloat(result.getValue(columns[12])),
        service_cost_p_w: parseFloat(result.getValue(columns[13])),
        equip_cost_p_w: parseFloat(result.getValue(columns[14])),
        sales_cost_p_w: parseFloat(result.getValue(columns[15])),
        margin_p_w: parseFloat(result.getValue(columns[16]))
      });
    });

    results = parseResults(results);

    let data = getData(results, indexes);

    data.forEach((d) => {
      let record = nRecord.create({
        type: 'customrecord_bb_project_statistics'
      });

      record.setValue('custrecord_bb_proj_stat_date', new Date());
      record.setValue('custrecord_bb_jobtype', d.job_type);
      record.setValue('custrecord_bb_installation_state', d.install_state);
      record.setValue('custrecord_bb_avg_contract_value_p_w', d.contract_value);
      record.setValue('custrecord_bb_avg_service_cost_p_w', d.service_cost_p_w);
      record.setValue('custrecord_bb_avg_equip_cost_p_w', d.equip_cost_p_w);
      record.setValue('custrecord_bb_total_project_count', d.projects.length);
      record.setValue('custrecord_bb_avg_system_size_decimal', d.system_size);
      record.setValue('custrecord_bb_avg_sales_cost_p_w', d.sales_cost_p_w);
      record.setValue('custrecord_bb_avg_margin_p_w', d.margin_p_w);
      record.setValue('custrecord_bb_proj_ave_days_new_to_m0_ct', d.new_to_m0);
      record.setValue('custrecord_bb_proj_ave_days_new_to_m1_ct', d.new_to_m1);
      record.setValue('custrecord_bb_proj_ave_days_new_to_m2_ct', d.new_to_m2);
      record.setValue('custrecord_bb_proj_ave_days_new_to_m3_ct', d.new_to_m3);
      record.setValue('custrecord_bb_proj_in_m0_count', d.m0_count);
      record.setValue('custrecord_bb_proj_in_m1_count', d.m1_count);
      record.setValue('custrecord_bb_proj_in_m2_count', d.m2_count);
      record.setValue('custrecord_bb_proj_in_m3_count', d.m3_count);
      record.setValue('custrecord_bb_proj_ave_days_m0_to_m1_ct', d.m0_to_m1);
      record.setValue('custrecord_bb_proj_ave_days_m1_to_m2_ct', d.m1_to_m2);
      record.setValue('custrecord_bb_proj_ave_days_m2_to_m3_ct', d.m2_to_m3);
      record.setValue('custrecord_bb_proj_ave_days_m1_to_m3_ct', d.m1_to_m3);
      record.setValue('custrecord_bb_proj_ave_days_m2_to_m3_ct', d.m2_to_m3);
      record.setValue('custrecord_bb_proj_ave_days_m0_to_m2_ct', d.m0_to_m2);
      record.setValue('custrecord_bb_proj_ave_days_m0_to_m3_ct', d.m0_to_m3);
      record.setValue('custrecord_bb_proj_in_final_milestone', d.completed);


      record.setValue('custrecord_bb_included_projects', d.projects);

      record.setValue('custrecord_bb_financing_type', d.financing_type);
      record.setValue('custrecord_bb_proj_adv_pmnt_schedule', d.adv_payment);
      record.setValue('custrecord_bb_statistics_financier', d.financier_customer);

      record.save();
    });
  }

  const purgeData = () => {
    let search = nSearch.create({
      type: 'customrecord_bb_project_statistics',
      columns: ['internalid'],
      filters: [
        ['custrecord_bb_proj_stat_date', 'within', 'today']
      ]
    });

    search.run().each((r) => {
      nRecord.delete({
        type: 'customrecord_bb_project_statistics',
        id: r.id
      });

      return true;
    });

  }

  const parseResults = (results) => {
    let dataSet = [];
    results.forEach((res) => {
      let project = dataSet.find((proj) => proj.id == res.id);
    
      if (!project) {
        project = {
          id: res.id,
          start_date: res.start_date,
          install_state: res.install_state,
          financier_customer: res.financier_customer,
          financing_type: res.financing_type,
          job_type: res.job_type,
          adv_payment: res.adv_payment,
          system_size: res.system_size,
          contract_value: res.contract_value,
          service_cost_p_w: res.service_cost_p_w,
          equip_cost_p_w: res.equip_cost_p_w,
          sales_cost_p_w: res.sales_cost_p_w,
          margin_p_w: res.margin_p_w
        };

        dataSet.push(project);
      }
    
      project[res.milestone.toLowerCase()] = res.milestone_date;
    });

    return dataSet;
  }

  const dateDiffInDays = (a, b) => {
    let _MS_PER_DAY = 1000 * 60 * 60 * 24;
    let utc1 = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
    let utc2 = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
    return Math.floor((utc2 - utc1) / _MS_PER_DAY) || 0;
  }

  const getData = (projects, indexes) => {
    // Group the projects by the required fields
    let grouped = projects.reduce((result, project) => {
      let key = [project.install_state, project.financier_customer, project.financing_type, project.job_type, project.adv_payment].join('|');

      if (!result[key]) {
        result[key] = {
          install_state: project.install_state,
          financier_customer: project.financier_customer,
          financing_type: project.financing_type,
          job_type: project.job_type,
          adv_payment: project.adv_payment,
          projects: [],
          projects_data: [],
          system_size: 0,
          contract_value: 0,
          service_cost_p_w: 0,
          equip_cost_p_w: 0,
          sales_cost_p_w: 0,
          margin_p_w: 0,
          m0_count: 0,
          m1_count: 0,
          m2_count: 0,
          m3_count: 0,
          m4_count: 0,
          completed: 0
        };
        
        // Initialize index fields
        indexes.forEach(index => {
          index.fields.forEach(field => {
            result[key][field] = 0;
            result[key][field + '_count'] = 0;
          });
        });
      }

      let group = result[key];

      group.projects.push(project.id);
      group.projects_data.push(project);
      group.system_size += project.system_size || 0;
      group.contract_value += project.contract_value || 0;
      group.service_cost_p_w += project.service_cost_p_w || 0;
      group.equip_cost_p_w += project.equip_cost_p_w || 0;
      group.sales_cost_p_w += project.sales_cost_p_w || 0;
      group.margin_p_w += project.margin_p_w || 0;
      
      let startDate = new Date(project.start_date);
      let shouldSkip = false;
      let isFirst = true;
      let countedMilestone = false;
      
      indexes.forEach((index, i) => {
        if (shouldSkip) 
          return; 

        if (typeof project[index.milestone] == 'undefined') {
          return;
        }

        let milestoneDate = project[index.milestone];
        let isLast = ((indexes[i+1] && typeof project[indexes[i+1].milestone] == 'undefined') || typeof indexes[i+1] == 'undefined');

        if (milestoneDate) {
          let milestoneDateObj = new Date(milestoneDate);

          if (isLast) {
            // is last and has date, count towards completed
            group.completed++;
          }

          if (i === 0) {
            group['new_to_m0'] += dateDiffInDays(startDate, milestoneDateObj);
            group['new_to_m0_count'] += 1;
          } else {
            index.fields.forEach((f) => {
              let pieces = f.split('_');
              let first = pieces[0];
              let last = pieces[2];

              if (first == 'new') {
                group['new_to_' + index.milestone] += dateDiffInDays(startDate, milestoneDateObj);
                group['new_to_' + index.milestone + '_count']++;
              } else {
                if (project[first] && project[last]) {
                  group[first + '_to_' + last] = dateDiffInDays(new Date(project[first]), milestoneDateObj);
                  group[first + '_to_' + last + '_count']++;
                }
              }
            });
          } 
        } else {
          if (!countedMilestone) {
            group[index.milestone + '_count']++;
            countedMilestone = true;
          }
        }

        if (isFirst) 
          isFirst = false;

        if (isLast) {
          shouldSkip = true;
        }
      });

      //console.log(lastProjectMilestone);

      return result;
    }, {});

    // Calculate averages and finalize the data
    let finalResult = Object.values(grouped).map(group => {
      let count = group.projects.length;
      
      group.system_size /= count;
      group.contract_value /= count;
      group.service_cost_p_w /= count;
      group.equip_cost_p_w /= count;
      group.sales_cost_p_w /= count;
      group.margin_p_w /= count;

      indexes.forEach(index => {
        index.fields.forEach(field => {
          if (group[field] && group[field + '_count']) {
            group[field] = Math.floor(group[field] / group[field + '_count']);
          }

          delete group[field + '_count'];
        });
      });

      return group;
    });

    return finalResult;
  }

  return {
    execute: execute
  };
});