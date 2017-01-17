'use strict';

const _ 			     = require('lodash'),
			BbPromise    = require('bluebird'),
			cfHelper     = require('./cloudFormation'),
			awsConstants = require('./constants');

class Plugin {
	constructor(serverless) {
    this.serverless = serverless;
		this.provider = this.serverless.getProvider('aws');
		this.service = this.serverless.service.service;
		this.region = this.provider.getRegion();
		this.stage = this.provider.getStage();

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
			.then(this.loopFunctions(this.updateLambdaConfig));
	}

	getAccountId() {
		if (this.accountId) {
			return BbPromise.resolve();
		}

		return this.provider.request('STS',
      'getCallerIdentity',
      {},
      this.stage,
      this.region)
		.then((res) => {
			this.accountId = res.Account;
			return BbPromise.resolve();
		});
	}

	loopFunctions(fn) {
		var self = this;
		var promise = BbPromise.resolve();

		_.each(this.serverless.service.functions, (fnDef, fnName) => {
			if (self.validateDeadLetterConfig(fnDef.deadLetterConfig)) {
				promise.then(() => fn.call(self, fnDef, fnName));
			}
		});

		return promise;
	}

	validateDeadLetterConfig(config) {
		if (!config || !config.type || !config.name) {
			return false;
		}
		return awsConstants[_.lowerCase(config.type)] !== undefined;
	}

	addCfResources(resources) {
		_.merge(this.serverless.service.provider.compiledCloudFormationTemplate.Resources, resources);
	}

	createDeadLetterResources() {
		var self = this;
		var policies = {};

		return this.loopFunctions((fnDef, fnName) => {
			const deadLetterConfig = fnDef.deadLetterConfig;
			const resource = cfHelper.getDeadLetterResource(deadLetterConfig.type, deadLetterConfig.name);
			self.addCfResources(resource);

			const deadLetterPolicyName = cfHelper.getDeadLetterPolicyName(deadLetterConfig.type);
			if (!policies[deadLetterPolicyName]) {
				_.merge(policies, cfHelper.getDeadLetterPolicy(deadLetterConfig.type, {
					region: self.region,
					stage: self.stage,
					service: self.service,
					accountId: self.accountId
				}));
			}

			const cfTemplate = self.serverless.service.provider.compiledCloudFormationTemplate;
			const roleName = cfTemplate.Resources[`${_.upperFirst(fnName)}LambdaFunction`]
				.Properties
				.Role["Fn::GetAtt"][0];

			const deadLetterPolicy = policies[deadLetterPolicyName];
			if (!deadLetterPolicy.DependsOn.includes(roleName)) {
				deadLetterPolicy.DependsOn.push(roleName);
				deadLetterPolicy.Properties.Roles.push({
					Ref: roleName
				});
			}
			return BbPromise.resolve();
		})
		.then(() => {
			this.addCfResources(policies);
			return BbPromise.resolve();
		})
	};

  updateLambdaConfig(fnDef, fnName) {
		const deadLetterConfig = fnDef.deadLetterConfig;
		const params = {
			FunctionName: fnDef.name,
			DeadLetterConfig: {
				TargetArn: `arn:aws:${_.lowerCase(deadLetterConfig.type)}:${this.region}:${this.accountId}:${deadLetterConfig.name}`
			}
		};

		return this.provider.request('Lambda',
      'updateFunctionConfiguration',
      params,
      this.stage,
      this.region
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
