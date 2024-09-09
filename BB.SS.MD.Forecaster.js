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
  let TEST = false;
  let configuration = {
    custrecord_bb_forecast_cash_account: 1,
    custrecord_bb_forecast_transaction_types: 7,
    custrecord_bb_forecast_project_status: [4, 5],
    custrecord_bb_avg_days_receive: 10 
  };
  
  const process = (context) => {
    let request = context.request;

    //getConfiguration();

    if (request.method == 'POST') {
      let data = JSON.parse(request.body);
      // available globally
      response = context.response; 

      if (data.action == 'getForecast') {
        getForecast();
      } 
    } else if (request.method == 'GET') {
      let parameters = request.parameters;

      if (parameters.goToProject) {
        let projectId = parameters.goToProject;

        nRedirect.toRecord({
          id: projectId,
          type: 'job'
        });
      } else if (parameters.goToTransaction) {
        nRedirect.toRecord({
          id: parameters.goToTransaction,
          type: parameters.type
        });
      } else if (parameters.goToExpense) {
        nRedirect.toRecord({
          id: parameters.goToExpense,
          type: 'customrecord_bb_ss_scheduled_forecast'
        });
      }
    }
  }

  const getConfiguration = () => {
    let search = nSearch.create({
      type: 'customrecord_bb_solar_success_configurtn',
      filters: [
        ['isinactive', 'is', 'F']
      ],
      columns: [
        'custrecord_bb_forecast_cash_account',
        'custrecord_bb_forecast_transaction_types',
        'custrecord_bb_forecast_project_status',
        'custrecord_bb_avg_days_receive'
      ]
    });

    search.run().each((r) => {
      configuration = {
        custrecord_bb_forecast_cash_account: r.getValue('custrecord_bb_forecast_cash_account'),
        custrecord_bb_forecast_transaction_types: r.getValue('custrecord_bb_forecast_transaction_types'),
        custrecord_bb_forecast_project_status: r.getValue('custrecord_bb_forecast_project_status'),
        custrecord_bb_avg_days_receive: parseInt(r.getValue('custrecord_bb_avg_days_receive')) || 0
      };
    });
  }

  const getForecast = () => {
    let data = getProjectStatistics();

    let projectIds = data.reduce((acc, cur) => {
      if (cur.projects) {
        return acc.concat(cur.projects);
      }
      return acc;
    }, []);


    let projectData = (projectIds.length) ? getProjectData(projectIds) : [];

    data = mergeData(data, projectData);


    let dateMap = generateDateMap(4, 8);

    let projects = data.map(d => d.projects).flat();


    let actuals = getActuals();

    let recurring = getRecurring();

    let balance = getBalance();
    let now = getBegginingOfWeek(new Date());

    now.setHours(0);
    now.setMinutes(0);
    now.setMilliseconds(0);
    now.setSeconds(0);
    
    dateMap = dateMap.map((d) => {
      let proj = projects.filter(r => r.expected == d.date);
      let act = actuals.filter(r => r.date == d.date);
      let rec = recurring[d.date] || [];
      
      let dat = new Date(d.date);
      let bal = 0;

      let accounts_receivable = 0;
      let accounts_payable = 0;

      proj.map(p => {
        accounts_payable += p.service;
        accounts_payable += p.equip;

        accounts_receivable += p.amount
      });

      act.map(a => {
        let due = (a.payables_due) ? parseFloat(a.payables_due) : 0;
        let ardue = (a.received_due) ? parseFloat(a.received_due) : 0;

        accounts_payable += due;
        accounts_receivable += ardue;
      });

      rec.map(r => {
        let ap = r.ap;
        let ar = r.ar;

        accounts_receivable += ar;
        accounts_payable += ap;
      });


      if (now.getTime() <= dat.getTime()) {
        balance = balance + (accounts_receivable - accounts_payable);
        bal = balance;
      }
  
      d.projects = proj;
      d.actuals = act;
      d.recurring = rec;
      d.accounts_receivable = accounts_receivable;
      d.accounts_payable = accounts_payable;
      d.net = accounts_receivable - accounts_payable;
      d.balance = bal;

      return d;
    });

    writeResponse(dateMap);
    //writeResponse(data);
  }

  const getBalance = (id) => {
    let balance = 0;
    let search = nSearch.create({
      type: 'account',
      filters: [
        ['internalidnumber', 'equalto', configuration.custrecord_bb_forecast_cash_account]
      ],
      columns: ['balance']
    });

    search.run().each((r) => {
      balance = parseFloat(r.getValue('balance'));
    });

    return balance;
  }

  const formatDate = (d) => {
    let day = d.getDate();
    let month = d.getMonth() + 1; 
    let year = d.getFullYear();

    // Pad month and day with leading zero if necessary
    if (day < 10) {
        day = '0' + day;
    }

    if (month < 10) {
        month = '0' + month;
    }

    return month + '/' + day + '/' + year;
  }

  const getRecurring = () => {
    let search = nSearch.create({
      type: 'customrecord_bb_ss_scheduled_forecast',
      filters: [
        ['isinactive', 'is', 'F'],
        'and',
        ['custrecord_bbss_sch_for_start', 'onorbefore', 'today'],
        'and',
        [
          ['custrecord_bbss_sch_for_end', 'after', 'today'],
          'or',
          ['custrecord_bbss_sch_for_end', 'isempty', '']
        ]
      ],
      columns: [
        'name',
        'custrecord_bbss_sch_for_repeats', 
        'custrecord_bbss_sch_for_start',
        'custrecord_bbss_sch_for_end', 
        'custrecord_bbss_sch_for_ap', 
        'custrecord_bbss_sch_for_ar'
      ]
    });
    let results = [];
    let recurring = {};

    search.run().each((r) => {
      results.push({
        name: r.getValue('name'),
        start: r.getValue('custrecord_bbss_sch_for_start'),
        end: r.getValue('custrecord_bbss_sch_for_end'),
        ap: r.getValue('custrecord_bbss_sch_for_ap'),
        ar: r.getValue('custrecord_bbss_sch_for_ar'),
        repeats: r.getText('custrecord_bbss_sch_for_repeats'),
        id: r.id
      });

      return true;
    });


    for (let i = 0; i < results.length; i++) {
      let result = results[i];
      let start_date = new Date(result.start);
      let copied_start = new Date(start_date.getTime());
      let end_date = result.end;
      let repeats = result.repeats;
    
      if (!end_date) {
        end_date = new Date();
        end_date.setFullYear(end_date.getFullYear() + 1);
      } else {
        end_date = new Date(end_date);
      }
    
      if (repeats == 'Monthly') {
        let start_day = start_date.getDate();
    
        while (copied_start < end_date) {
          start_date = new Date(copied_start.getTime());
    
          beggining = getBegginingOfWeek(start_date);
          start_string = formatDate(beggining);
    
          if (start_date <= end_date) {
            recurring[start_string] = (recurring[start_string]) ? recurring[start_string] : [];
            recurring[start_string].push({ap: parseFloat(result.ap) || 0, ar: parseFloat(result.ar) || 0, name: result.name, id: result.id, date: start_string})
          }
    
          copied_start.setMonth(copied_start.getMonth() + 1);
          copied_start.setDate(start_day);
        }
      }
    }

    return recurring;
  }

  const getActuals = () => {
    let search = nSearch.load({
      id: 'customsearch_bb_ss_cash_forecaster_act'
    });
    let columns = search.columns;
    let results = [];

    search.run().each((res) => {
      let d = getBegginingOfWeek(new Date(res.getValue(columns[6])));
      let expected_date = new Date(res.getValue(columns[6]));
      d = formatDate(d);
      let payables_due = res.getValue(columns[2]) || 0;

      results.push({
        received: parseFloat(res.getValue(columns[1])),
        received_due: parseFloat(res.getValue(columns[0])),
        payables_due: payables_due,
        payables_paid: parseFloat(res.getValue(columns[3])),
        date: d,
        type: res.getValue(columns[7]),
        type_text: res.getText(columns[9]),
        document: res.getValue(columns[8]),
        expected_date: formatDate(expected_date),
        id: res.id
      });

      return true;
    });

    return results;
  }

  const generateDateMap = (pastWeeks, futureWeeks) => {
    let startDate = getBegginingOfWeek(new Date());
    let dateMap = [];

    // Go back the specified number of weeks
    for(let i = 0; i < pastWeeks; i++) {
      startDate.setDate(startDate.getDate() - 7);
      let dateString = formatDate(startDate);
      dateMap.unshift({date: dateString, projects: [], actuals: []});
    }

    // Reset to the start date
    startDate = getBegginingOfWeek(new Date());

    // Include the start week and go forward the specified number of weeks
    for(let i = 0; i <= futureWeeks; i++) {
      let dateString = formatDate(startDate);
      dateMap.push({date: dateString, projects: [], actuals: []});
      startDate.setDate(startDate.getDate() + 7);
    }

    return dateMap;
  }

  const getBegginingOfWeek = (d) => {
    let day = d.getDay();
    let diff = d.getDate() - day + (day == 0 ? -6 : 1);

    return new Date(d.setDate(diff));
  }

  const mergeData = (data, projectData) => {
    return data.map((d) => {
      let projects = d.projects.map((id) => {
        let results = projectData.filter(r => r.id === id);

        return results.map(item => {
          let expected;

          if (item.milestone_date) {
            expected = new Date(item.milestone_date);
            expected.setDate(expected.getDate() + configuration.custrecord_bb_avg_days_receive);
          } else {
            expected = new Date(item.start_date);
            let milestone = item.milestone.toLowerCase();
            let k = `new_to_${milestone}`;
            let days = (d[k]) ? parseInt(d[k]) : 0;

            days += configuration.custrecord_bb_avg_days_receive;

            expected.setDate(expected.getDate() + days);
          }

          let expected_time = expected.getTime();

          expected = getBegginingOfWeek(expected);

          expected = formatDate(expected);

          let is_install = (item.is_install && d.system_size && d.equip_cost && d.service_cost) ? true : false;

          let service = 0;
          let equip = 0;
          let system_size = parseFloat(d.system_size);
          let equip_cost = parseFloat(d.equip_cost);
          let service_cost = parseFloat(d.service_cost);

          if (is_install) {
            service = (system_size * 1000) * service_cost;
            equip = (system_size * 1000) * equip_cost;
          }

          return {
            id: id,
            milestone_date: item.milestone_date,
            amount: parseFloat(item.amount) || 0,
            milestone: item.milestone,
            start_date: item.start_date,
            expected: expected,
            expected_date: formatDate(new Date(expected_time)),
            job: item.job,
            service: service,
            equip: equip,
            ap: service + equip
          }
        });
      });

      d.projects = projects.flat();

      return d;
    });
  }

  const getProjectStatistics = () => {
    let results = [];
    let search = nSearch.create({
      type: 'customrecord_bb_project_statistics',
      filters: [
        ['isinactive', 'is', 'F'],
        'and',
        ['custrecord_bb_proj_adv_pmnt_schedule', 'noneof', '@NONE@'],
        'and',
        ['custrecord_bb_proj_stat_date', 'within', 'today'],
        'and',
        ['custrecord_bb_proj_in_final_milestone', 'greaterthan', 0]
      ],
      columns: [
        'custrecord_bb_proj_ave_days_new_to_m0_ct',
        'custrecord_bb_proj_ave_days_new_to_m1_ct',
        'custrecord_bb_proj_ave_days_new_to_m2_ct',
        'custrecord_bb_proj_ave_days_new_to_m3_ct',
        'custrecord_bb_included_projects',
        'custrecord_bb_avg_service_cost_p_w',
        'custrecord_bb_avg_equip_cost_p_w',
        'custrecord_bb_avg_system_size_decimal'
      ]
    });

    search.run().each((res) => {
      results.push({
        new_to_m0: res.getValue('custrecord_bb_proj_ave_days_new_to_m0_ct'),
        new_to_m1: res.getValue('custrecord_bb_proj_ave_days_new_to_m1_ct'),
        new_to_m2: res.getValue('custrecord_bb_proj_ave_days_new_to_m2_ct'),
        new_to_m3: res.getValue('custrecord_bb_proj_ave_days_new_to_m3_ct'),
        projects: res.getValue('custrecord_bb_included_projects').split(','),
        id: res.id,
        system_size: res.getValue('custrecord_bb_avg_system_size_decimal'),
        equip_cost: res.getValue('custrecord_bb_avg_equip_cost_p_w'),
        service_cost: res.getValue('custrecord_bb_avg_service_cost_p_w')
      });

      return true;
    });

    return results;
  }

  const getProjectData = (projectIds) => {
    let columns = [
      nSearch.createColumn({
        name: 'custrecord_bbss_adv_subpay_milestonedate',
        join: 'CUSTRECORD_BBSS_ADV_SUBPAY_PROJECT'
      }),
      nSearch.createColumn({
        name: 'custrecord_bbss_adv_subpay_amount',
        join: 'CUSTRECORD_BBSS_ADV_SUBPAY_PROJECT'
      }),
      nSearch.createColumn({
        name: 'custrecord_bbss_adv_subpay_milestone',
        join: 'CUSTRECORD_BBSS_ADV_SUBPAY_PROJECT'
      }),
      nSearch.createColumn('custentity_bb_project_start_date'),
      nSearch.createColumn('entityid'),
      nSearch.createColumn({
        name: 'custrecord_bbss_adv_subpay_action_list',
        join: 'CUSTRECORD_BBSS_ADV_SUBPAY_PROJECT'
      }),
      nSearch.createColumn({
        name: 'custentity_bb_system_size_decimal'
      })
    ];
    let search = nSearch.create({
      type: 'job',
      filters: [
        ['internalid', 'anyof', projectIds],
        'and',
        ['custrecord_bbss_adv_subpay_project.custrecord_bbss_adv_subpay_trans_type', 'anyof', configuration.custrecord_bb_forecast_transaction_types]
      ],
      columns: columns
    });
    let results = [];

    search.run().each((res) => {
      let action = res.getValue(columns[5]);

      results.push({
        milestone_date: res.getValue(columns[0]),
        amount: res.getValue(columns[1]),
        milestone: res.getText(columns[2]),
        start_date: res.getValue(columns[3]),
        job: res.getValue(columns[4]),
        is_install: (action == 24),
        system_size: res.getValue(columns[6]),
        id: res.id
      });

      return true;
    });

    return results;
  }

  const getAdvPayments = () => {
    let schedules = [];
    let columns = [
      nSearch.createColumn({
        name: "internalid"
      }),
      nSearch.createColumn({
        name: "name",
        label: "Name"
      }),
      nSearch.createColumn({
        name: "custrecord_bb_fams_milestone",
        join: "CUSTRECORD_BB_FAMS_FIN_ADVPAY_SCHEDULE",
        sort: nSearch.Sort.ASC
      }),
      nSearch.createColumn({
        name: "custrecord_bb_fams_action",
        join: "CUSTRECORD_BB_FAMS_FIN_ADVPAY_SCHEDULE"
      })
    ];
    let search = nSearch.create({
      type: "customrecord_bb_financier_adv_pmt_sch",
      filters:
      [
        ["custrecord_bb_fams_fin_advpay_schedule.isinactive","is","F"], 
        "AND", 
        ["isinactive","is","F"],
        "AND",
        ["custrecord_bb_fams_fin_advpay_schedule.custrecord_bb_fams_trans_type", "anyof", [configuration.custrecord_bb_forecast_transaction_types]]
      ],
      columns: columns
    });

    search.run().each((res) => {
      let id = res.getValue(columns[0]);
      let schedule = schedules.find((x) => x.id == id);
      let milestone = res.getText(columns[2]);
      let action = res.getText(columns[3]);
      
      if (!schedule) {
        if (milestone && action) {
          schedule = {
            id: res.getValue(columns[0]),
            name: res.getValue('name'),
            milestones: []
          };

          schedule.milestones.push({
            milestone: milestone,
            action: action
          });
      
          schedules.push(schedule);
        }
      } else {
        schedule.milestones.push({
          milestone: milestone,
          action: action
        });
      }

      return true;
    });


    let projects = getProjects(schedules);

    getMilestones(projects);

    projects = projects.filter((p) => p.milestones?.length);

    let dataSet = buildDataSet(projects, schedules);


    writeResponse({
      dataSet: dataSet.dataset,
      columns: dataSet.columns,
      schedules: schedules
    });
  }

  /*const buildDataSet = (projects, schedules) => {
    let selected = 4;
    let schedule = schedules.find((s) => s.id == selected);

    projects = projects.filter((p) => p.payment_schedule == selected);

    log.debug('projects', projects);

    log.debug('schedule', schedule);

    let columns = [];
    let data = [];

    let financiers = projects.map((p) => { 
      return {
        financier: p.financier, 
        averages: []
      }
    });

    log.debug('financiers', financiers);


    for (let i = 0; i < schedule.milestones.length; i++) {
      let currentMilestone = schedule.milestones[i];

      columns.push('New to ' + currentMilestone.milestone);

      if (i) {
        columns.push(schedule.milestones[i - 1].milestone + ' to ' + currentMilestone.milestone);
      }

      // loop through projects and get numbers for averages
      for (let x = 0; x < projects.length; x++) {
        let financier = financiers.find((f) => f.financier == projects[i].financier);


      }
    }

    writeResponse({results: projects});

    log.debug('columns', columns);

  }*/
  const buildDataSet = (projects, schedules) => {
    let selected = (TEST) ? 15 : 4;
    let schedule = schedules.find((s) => s.id == selected);


    projects = projects.filter((p) => p.payment_schedule == selected);

    // Group projects by financier
    let projectsByFinancier = projects.reduce((acc, project) => {
      if (!acc[project.financier]) {
        acc[project.financier] = [];
      }
      acc[project.financier].push(project);
      return acc;
    }, {});
  
    let columns = new Set();

    schedule.milestones.forEach((milestone, index) => {
      columns.add(`New to ${milestone.milestone}`);
      if (index > 0) {
        let prevMilestone = schedule.milestones[index - 1].milestone;
        columns.add(`${prevMilestone} to ${milestone.milestone}`);
      }
    });

    // Calculate the average for each financier group
    let dataset = Object.entries(projectsByFinancier).map(([financier, financierProjects]) => {
      let financierAverages = {};
      let projects = [];
  
      financierProjects.forEach((project) => {
        let differences = calculateDifferences(project, schedule);
        projects.push({entityId: project.entity_id, id: project.id});
  
        Object.entries(differences).forEach(([key, value]) => {
          //columns.add(key);

          if (financierAverages[key]) {
            financierAverages[key].sum += value;
            financierAverages[key].count++;
          } else {
            financierAverages[key] = { sum: value, count: 1 };
          }
        });
      });
  
      let averages = {
        financier,
        projects,
        ...Object.fromEntries(Object.entries(financierAverages).map(([key, { sum, count }]) => [key, parseFloat((sum / count).toFixed(2))]))
      };
  
      return averages;
    });
  
    return { dataset, columns: Array.from(columns) };
  }
  
  const calculateDifferences = (project, schedule) => {
    let milestoneDiffs = {};
  
    schedule.milestones.forEach((milestone, index) => {
      let projectMilestone = project.milestones.find((m) => m.milestone === milestone.milestone);
  
      if (!projectMilestone || !projectMilestone.date) return;
  
      let startDate = new Date(project.start_date);
      let milestoneDate = new Date(projectMilestone.date);
      let diff = (milestoneDate - startDate) / (1000 * 60 * 60 * 24);
  
      milestoneDiffs[`New to ${milestone.milestone}`] = diff;
  
      if (index > 0) {
        let prevScheduleMilestone = schedule.milestones[index - 1];
        let prevProjectMilestone = project.milestones.find((m) => m.milestone === prevScheduleMilestone.milestone);
  
        if (!prevProjectMilestone || !prevProjectMilestone.date) return;
  
        let prevMilestoneDate = new Date(prevProjectMilestone.date);
        let diffBetweenMilestones = (milestoneDate - prevMilestoneDate) / (1000 * 60 * 60 * 24);
        milestoneDiffs[`${prevScheduleMilestone.milestone} to ${milestone.milestone}`] = diffBetweenMilestones;
      }
    });
  
    return milestoneDiffs;
  }

  const average = (arr) => {
    if (arr.length === 0) {
      return 0;
    }
  
    let sum = arr.reduce((total, currentValue) => total + currentValue, 0);
    return sum / arr.length;
  }


  const getMilestones = (projects) => {
    let results = [];
    let search = nSearch.create({
      type: "customrecord_bbss_adv_sub_pay_schedule",
      filters:
      [
        ["custrecord_bbss_adv_subpay_project", "anyof", projects.map((x) => x.id)],
        "AND", 
        ["custrecord_bbss_adv_subpay_trans_type","anyof",[configuration.custrecord_bb_forecast_transaction_types]]
      ],
      columns:
      [
        nSearch.createColumn({
          name: "custrecord_bbss_adv_subpay_milestone",
          sort: nSearch.Sort.ASC,
          label: "Milestone"
        }),
        nSearch.createColumn({name: "custrecord_bbss_adv_subpay_action_list"}),
        nSearch.createColumn({name: "custrecord_bbss_adv_subpay_amount"}),
        nSearch.createColumn({name: "custrecord_bbss_adv_subpay_amount_pct"}),
        nSearch.createColumn({
          name: "custrecord_bbss_adv_subpay_milestonedate",
          sort: nSearch.Sort.ASC
        }),
        nSearch.createColumn({name: "custrecord_bbss_adv_subpay_transaction"}),
        nSearch.createColumn({name: "custrecord_bbss_adv_subpay_trans_total"}),
        nSearch.createColumn({name: "custrecord_bbss_adv_subpay_project"})
      ]
    });

    search.run().each((res) => { 
      let id = res.getValue('custrecord_bbss_adv_subpay_project');
      let project = projects.find((x) => x.id == id);

      if (!project.milestones) 
        project.milestones = [];

      let date = res.getValue('custrecord_bbss_adv_subpay_milestonedate');
      let previousDate;

      if (project.milestones.length) {
        previousDate = project.milestones[project.milestones.length - 1]?.date;
      } else {
        previousDate = project.start_date;
      }

      project.milestones.push({
        milestone: res.getText('custrecord_bbss_adv_subpay_milestone'),
        action: res.getText('custrecord_bbss_adv_subpay_action_list'),
        amount: parseFloat(res.getValue('custrecord_bbss_adv_subpay_amount')),
        amount_percentage: res.getValue('custrecord_bbss_adv_subpay_amount_pct'),
        date: date,
        transaction: res.getValue('custrecord_bbss_adv_subpay_transaction'),
        transaction_amount: parseFloat(res.getValue('custrecord_bbss_adv_subpay_trans_total')),
        new_to: (date) ? getDifferenceInDays(project.start_date, date) : '',
        previous_to: (date && previousDate) ? getDifferenceInDays(previousDate, date) : ''
      });

      return true;
    });

    return results;
  }

  const getDifferenceInDays = (d1, d2) => {
    let date1 = new Date(d1).getTime();
    let date2 = new Date(d2).getTime();

    let difference = Math.abs(date1 - date2);
    let millisecondsDay = 24 * 60 * 60 * 1000;

    return difference / millisecondsDay;
  }

  const getProjects = (schedules) => {
    let results = [];
    let search = nSearch.create({
      type: "job",
      filters: [
        ["custentity_bb_project_status","noneof", configuration.custrecord_bb_forecast_project_status],
        "and",
        ["custentity_bb_financier_adv_pmt_schedule","anyof", schedules.map((x) => x.id)]
      ],
      columns: [
        'internalid', 
        'custentity_bb_project_start_date', 
        'custentity_bb_financier_adv_pmt_schedule',
        'custentity_bb_install_state',
        'custentity_bb_financier_customer',
        'entityid'
      ]
    });

    search.run().each((res) => {
      //if (res.getValue('internalid') == 1042916)
       
        results.push({
          id: res.getValue('internalid'),
          start_date: res.getValue('custentity_bb_project_start_date'),
          payment_schedule: res.getValue('custentity_bb_financier_adv_pmt_schedule'),
          state: res.getText('custentity_bb_install_state'),
          financier: res.getText('custentity_bb_financier_customer'),
          entity_id: res.getValue('entityid')
        });

      return true;
    });

    return results;
  }

  const writeResponse = (data) => {
    response.write({output: JSON.stringify(data)});
  }

  return {
    process: process
  };
});
