/**
 * @NApiVersion 2.1
 * @NModuleScope Public
 * @NScriptType Suitelet
 */
define([
  'N/search', 
  'N/redirect',
  'N/url',

  './Modules/BB.SS.MD.Forecaster', // continue adding as needed.
  './Modules/BB.SS.MD.Scheduler',
  './Modules/BB.SS.MD.Charts',
  './Modules/BB.SS.MD.CashVisualization',
  './Modules/BB.SS.MD.ProjectProfitability',
  './Modules/BB.SS.MD.ProjectProfitabilityEstimated'
], (
  nSearch, 
  nRedirect,
  nUrl,

  ForecasterService,
  SchedulerService,
  ChartsService,
  CashVisualizationService,
  ProjectProfitabilityService,
  ProjectProfitabilityEstimatedService
) => {

  const services = {
    forecaster: ForecasterService,
    scheduler: SchedulerService,
    charts: ChartsService,
    cashvisualization: CashVisualizationService,
    projectprofitability: ProjectProfitabilityService,
    projectprofitabilityestimated: ProjectProfitabilityEstimatedService
  }

  const onRequest = (context) => {
    let request = context.request;
    let parameters = request.parameters;
    let service = parameters && parameters.service;

    if (services[service])
      services[service].process(context);
  }
 
  return {
    onRequest: onRequest
  };
});