/**
 *@NApiVersion 2.1
 *@NScriptType Portlet
 */
 define(
[
  'N/url',
  'N/runtime'
], 
(
  nUrl,
  nRuntime
) => {
  const render = (params) => {
    let script = nRuntime.getCurrentScript();
    let title = script.getParameter('custscript_bb_ss_pl_title');
    let height = script.getParameter('custscript_bb_ss_pl_height');
    let uri = script.getParameter('custscript_bb_ss_pl_uri'); 

    let portlet = params.portlet;
    portlet.title = title;

    let url = nUrl.resolveScript({
      scriptId: 'customscript_bb_ss_sl_solarsuccess_main',
      deploymentId: 'customdeploy_bb_ss_sl_solarsuccess_main'
    });
    
    let content = '<iframe src="' + url + '#/' + uri + '" border="0" frameborder="0" scrolling="no" width="100%" height="' + height + 'px"></iframe>';
    
    params.portlet.html = content;
  }

  return {
    render: render
  };
});