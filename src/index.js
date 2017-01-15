'use strict';

const _ = require('lodash'),
		AWS = require('aws-sdk');

class Plugin {
	constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;

		this.initAws();

		this.hooks = {
			// 'deploy:compileEvents': this.loopEvents.bind(this, this.createDeadLetterTargets),
			'deploy:deploy': this.loopEvents.bind(this, this.configureDeadLetterTarget)
		};
  }

	initAws() {
		this.lambda = new AWS.Lambda({ region: 'eu-west-1'});
	}

	loopEvents(fn) {
		var self = this;

		_.each(this.serverless.service.functions, function(fnDef, fnName) {
			if (fnDef.deadLetterConfig && fnDef.deadLetterConfig.targetArn) {
				fn.call(self, fnName, fnDef);
			}
		});
	}

	// addCfResources(resources) {
	// 	_.merge(this.serverless.service.provider.compiledCloudFormationTemplate.Resources, resources);
	// }
	//
	// getCfSnsTopic(topicName) {
	// 	return {
	// 		Type: 'AWS::SNS::Topic',
	// 		Properties: {
	// 			TopicName: topicName,
	// 		}
	// 	};
	// }
	//
	// getCfSqsQueue(queueName) {
	// 	return {
	// 		Type: 'AWS::SQS::Queue',
	// 		Properties: {
	// 			QueueName: queueName,
	// 		}
	// 	};
	// }

	// amendLambdaPolicy(targetName, type) {
	// 	var policy = {
  //     Effect: 'Allow',
  //     Action: [
  //       'sqs:SendMessage'
  //     ],
	// 		Resource: `arn:aws:sqs:eu-west-1::${targetName}`
  //   };

		// var statement = this.serverless.service.provider.compiledCloudFormationTemplate
		// 	.Resources
		// 	.IamPolicyLambda
		// 	.Properties
		// 	.PolicyDocument
		// 	.Statement;
		//
		// console.log(JSON.stringify(statement));
		//
		// statement = statement.concat(policy);
	// 	console.log(JSON.stringify(this.serverless.service.provider.compiledCloudFormationTemplate));
	// }

	// createDeadLetterTargets(fnName, fnDef) {
	// 	var target = fnDef.deadLetterConfig.target;
	// 	var type = fnDef.deadLetterConfig.type;
	//
	// 	this.addCfResources({
	// 		[`SQSQueue${_.upperFirst(_.camelCase(target))}`]: this.getCfSqsQueue(target)
	// 	});
	//
	// 	fnDef.role =
	//
	// 	this.createLambdaPolicy(target, type);
	// }

	// addSendPermission(fnName, fnDef) {
		// var permission = {
		// 	FunctionName: { 'Fn::GetAtt': [ fnRef, 'Arn' ] },
		// 	Action: 'lambda:InvokeFunction'
		// 	Principal: "sqs.amazonaws.com",
		//
		// }
		// this.lambda.addPermission({
		// 	FunctionName: fnDef.name,
		// 	Action: 'lambda:InvokeFunction'
		// 	Principal: "sqs.amazonaws.com",
		//
		// })
	// }

  configureDeadLetterTarget(fnName, fnDef) {
		var params = {
			FunctionName: fnDef.name,
			DeadLetterConfig: {
				TargetArn: fnDef.deadLetterConfig.targetArn
			}
		};

		this.lambda.updateFunctionConfiguration(params)
			.promise()
			.then((res) => {
				this.serverless.cli.log(`DeadLetterTarget configured for ${fnDef.name}`);
			})
			.catch((err) => {
				throw new this.serverless.classes.Error(err.message);
			});
  }
}

module.exports = Plugin;
