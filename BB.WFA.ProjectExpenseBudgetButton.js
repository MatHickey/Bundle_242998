/**
 * @NApiVersion 2.1
 * @NScriptType WorkflowActionScript
 */
define(['N/runtime', 'N/url'],
  /**
   * @param{runtime} runtimeModule
   * @param{url} urlModule
   */
  (runtimeModule, urlModule) => {
    /**
     * Defines the WorkflowAction script trigger point.
     * @param {Object} scriptContext
     * @param {Record} scriptContext.newRecord - New record
     * @param {Record} scriptContext.oldRecord - Old record
     * @param {string} scriptContext.workflowId - Internal ID of workflow which triggered this action
     * @param {string} scriptContext.type - Event type
     * @param {Form} scriptContext.form - Current form that the script uses to interact with the record
     * @since 2016.1
     */
    const onAction = (scriptContext) => {
      try {
        const
          _record = scriptContext.newRecord
          , _form = scriptContext.form
          , _currentScript = runtimeModule.getCurrentScript()
          , _title = _currentScript.getParameter({name: 'custscript_bb_proj_exp_budg_title'}) || 'Manage Budget'
          , _script = 'customscript_bb_sl_proj_exp_budget'
          , _deployment = _currentScript.getParameter({name: 'custscript_bb_proj_exp_budg_deploy'}) || 'customdeploy_bb_sl_proj_exp_budget'
          , _config = _currentScript.getParameter({name: 'custscript_bb_proj_exp_budg_config'}) || 1
          , _size = _currentScript.getParameter({name: 'custscript_bb_proj_exp_budg_size'}) || 0
          , _so = _currentScript.getParameter({name: 'custscript_bb_proj_exp_budg_so'}) || null
          , _buttonId = ['custpage_budget_button', Math.random().toString(36).slice(2, 7)].join('_')
          , _suiteletUrl = urlModule.resolveScript({
            scriptId: _script
            , deploymentId: _deployment
            , params: {
              project: _record.id,
              salesOrder: _so,
              systemSize: _size,
              configId: _config
            }
          })
        ;
        _form.addButton({
          id: _buttonId,
          label: _title,
          functionName: ['window.open("', _suiteletUrl, '")'].join('')
        });
      } catch (error) {
        log.error({
          title: 'EXPENSE_BUDGET_ADD_BUTTON_ERROR',
          details: error.message
        });
      }
    }

    return {onAction};
  });
