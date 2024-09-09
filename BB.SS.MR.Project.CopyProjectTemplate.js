/**
 *@NApiVersion 2.x
 *@author Michael Golichenko
 *@NScriptType MapReduceScript
 */

define(['N/runtime','./BB SS/SS Lib/BB.SS.MD.Project.CopyProjectTemplate'],
    function(runtime, copyProjectTemplate) {

      function getInputData() {
        try{
          var script = runtime.getCurrentScript();
          var projectTemplateId = script.getParameter({name: 'custscript_bb_project_template_id'});
          return [copyProjectTemplate.getCopyData(projectTemplateId)];
        } catch(error){
          log.debug('getInputData Error',error);
        }
      }

      //runs for each search result
      function map(context) {
        var _projectData = JSON.parse(context.value);
        var _newProjectTemplateId = copyProjectTemplate.createCopy(_projectData);
        var _orgProjectTemplateId = _projectData.custentity_bb_started_from_proj_template;
        copyProjectTemplate.copyProjectPackageAction(_newProjectTemplateId, _orgProjectTemplateId);
      }

      function reduce(context) {

        //add tasks for recId from map function
      }

      function summarize(context) {
        //summarize results at the end
      }

      return {
        getInputData: getInputData,
        map: map,
        reduce: reduce,
        summarize: summarize
      };

    });