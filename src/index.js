'use strict';

const _ 			      = require('lodash'),
			BbPromise     = require('bluebird'),
			cfHelper      = require('./cloudFormation'),
			promiseHelper = require('./promise'),
			awsConstants  = require('./constants');

class Plugin {
	constructor(serverless) {
    this.serverless = serverless;
		this.provider = this.serverless.getProvider('aws');
		this.functions = this.serverless.service.functions;

		this.settings = {};
		this.settings.service = this.serverless.service.service;
		this.settings.region = this.provider.getRegion();
		this.settings.stage = this.provider.getStage();

		this.hooks = {
			'deploy:compileEvents': () => BbPromise.bind(this).then(this.createResources),
			'deploy:deploy': () => BbPromise.bind(this).then(this.configureFunctions)
		};
  }

	createResources() {
		return BbPromise.bind(this)
			.then(this.getAccountId)
			.then(this.createDeadLetterResources);
	}

	configureFunctions() {
		return BbPromise.bind(this)
			.then(this.getAccountId)
			.then(() => promiseHelper.each(this.functions, this.updateLambdaConfig.bind(this)));
	}

	getAccountId() {
		if (this.accountId) {
			return BbPromise.resolve();
		}

		return this.provider.request('STS',
      'getCallerIdentity',
      {},
      this.settings.stage,
      this.settings.region)
		.then((res) => {
			this.settings.accountId = res.Account;
			return BbPromise.resolve();
		});
	}

	validateDeadLetterConfig(config) {
		if (!config || !config.type || !config.name) {
			return false;
		}
		return awsConstants[_.lowerCase(config.type)] !== undefined;
	}

	createDeadLetterResources() {
		var self = this;
		var origCf = self.serverless.service
			.provider
			.compiledCloudFormationTemplate
			.Resources;

		const newCf = _.map(self.functions, function(value, prop) {
  		return {
				fnName: prop,
				fnDef: value
			};
		}).reduce(self.createFunctionResources.bind(self), origCf);

		_.merge(origCf, newCf);

		return BbPromise.resolve();
	}

	createFunctionResources(cf, fnConfig) {
		const dlConfig = fnConfig.fnDef.deadLetterConfig;
		if (!this.validateDeadLetterConfig(dlConfig)) {
			return cf;
		}

		const resource = cfHelper.getDeadLetterResource(dlConfig.type, dlConfig.name);
		const dlPolicyName = cfHelper.getDeadLetterPolicyName(dlConfig.type);
		const origPolicy = cf[dlPolicyName]
			? { [dlPolicyName]: origPolicy }
			: cfHelper.getDeadLetterPolicy(dlConfig.type, this.settings);

		const fnRoleName = cf[`${_.upperFirst(fnConfig.fnName)}LambdaFunction`].Properties.Role["Fn::GetAtt"][0];
		const newPolicy = cfHelper.addRoleToPolicy(origPolicy, fnRoleName);

		return _.merge({}, cf, resource, newPolicy);
	}

  updateLambdaConfig(fnDef, fnName) {
		const dlConfig = fnDef.deadLetterConfig;
		if (!this.validateDeadLetterConfig(dlConfig)) {
			return BbPromise.resolve();
		}

		const params = {
			FunctionName: fnDef.name,
			DeadLetterConfig: {
				TargetArn: `arn:aws:${_.lowerCase(dlConfig.type)}:${this.settings.region}:${this.settings.accountId}:${dlConfig.name}`
			}
		};

		return this.provider.request('Lambda',
      'updateFunctionConfiguration',
      params,
      this.settings.stage,
      this.settings.region
		).then(() => {
			this.serverless.cli.log(`DeadLetterTarget configured for ${fnDef.name}`);
			return BbPromise.resolve();
		})
		.catch((err) => {
			throw new this.serverless.classes.Error(err.message);
		});
  }

	// isArn(targetName) {
	// 	var regexp = /arn:aws:([a-zA-Z0-9\-])+:([a-z]{2}-[a-z]+-\d{1})?:(\d{12})?:(.*)/;
	// 	return targetName.match(regexp) !== null;
	// }
}

module.exports = Plugin;
