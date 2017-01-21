'use strict';

const _ 		       = require('lodash'),
	  BbPromise      = require('bluebird'),
	  templateHelper = require('./template'),
    namingHelper   = require('./naming'),
	  lazy		       = require('./lazy'),
    definitions    = require('./definitions')();

class Plugin {
	constructor(serverless) {
    this.serverless = serverless;
		this.provider = this.serverless.getProvider('aws');
    this.functions = _.map(this.serverless.service.functions, 
      (value, prop) => ({ fnName: prop, fnDef: value }));
		this.getSettings = lazy(this._getSettings.bind(this), 
			this.serverless.service.service, 
			this.provider.getRegion(), 
			this.provider.getStage());

		this.hooks = {
			'deploy:compileEvents': () => BbPromise.bind(this).then(this.buildResources),
			'deploy:deploy': () => BbPromise.bind(this).then(this.configureFunctions)
		};
  }

	buildResources() {
    let origCf = this.serverless.service.provider.compiledCloudFormationTemplate.Resources;

		return BbPromise.bind(this)
			.then(this.getSettings)
      .then(settings => BbPromise.reduce(this.functions, this.buildDeadLetterTarget.bind(this, settings), origCf))
      .then(newCf => {
        _.merge(origCf, newCf);
        return BbPromise.resolve();
      });
	}

	configureFunctions() {
		return BbPromise.bind(this)
			.then(this.getSettings)
			.then(settings => BbPromise.each(this.functions, this.updateLambdaConfig.bind(this, settings)));
	}

	buildDeadLetterTarget(settings, cf, fnConfig) {
		const dlConfig = fnConfig.fnDef.deadLetterConfig;
		if (!this._validateDeadLetterConfig(dlConfig)) {
			return cf;
		}

    const resource = !namingHelper.isArn(dlConfig.target)
      ? templateHelper.getDeadLetterResource(dlConfig.type, dlConfig.target)
      : null;
		const dlPolicyName = namingHelper.getDeadLetterPolicyName(dlConfig.type);
		const origPolicy = cf[dlPolicyName]
			? { [dlPolicyName]: origPolicy }
			: templateHelper.getDeadLetterPolicy(dlConfig.type, settings);

		const fnRoleName = cf[namingHelper.getLambdaFunctionLogicalId(fnConfig.fnName)]
      .Properties.Role["Fn::GetAtt"][0];
		const newPolicy = templateHelper.addRoleToPolicy(origPolicy, fnRoleName);

    return _.merge({}, cf, resource, newPolicy);
	}

	updateLambdaConfig(settings, fnConfig) {
		const dlConfig = fnConfig.fnDef.deadLetterConfig;
		if (!this._validateDeadLetterConfig(dlConfig)) {
			return BbPromise.resolve();
		}

		const params = {
			FunctionName: fnConfig.fnDef.name,
			DeadLetterConfig: {
				TargetArn: !namingHelper.isArn(dlConfig.target)
          ? namingHelper.getDeadLetterTargetArn(dlConfig.type, dlConfig.target, settings)
          : dlConfig.target
			}
		};

		return this.provider.request('Lambda', 'updateFunctionConfiguration', params, settings.stage, settings.region)
			.then(() => {
				this.serverless.cli.log(`DeadLetterTarget configured for ${fnConfig.fnDef.name}`);
				return BbPromise.resolve();
			})
			.catch(err => {
        throw new this.serverless.classes.Error(err.message)
      });
	}

  _getSettings(service, region, stage) {
		return this.provider.request('STS', 'getCallerIdentity', {}, stage, region)
			.then((res) => {
				return {
					service: service,
					region: region,
					stage: stage,
					accountId: res.Account
				};
			});
	}

  _validateDeadLetterConfig(config) {
		if (!config || !config.type || !config.target) {
			return false;
		}
		return definitions[_.lowerCase(config.type)] !== undefined;
	}
}

module.exports = Plugin;
